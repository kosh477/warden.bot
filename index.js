const zlib = require("zlib");
const zmq = require("zeromq");
const { Pool } = require('pg')

require("dotenv").config();

const SOURCE_URL = 'tcp://eddn.edcd.io:9500'; //EDDN Data Stream URL
const targetstate = "Boom"; //The current system state to check for (Incursion)
let msg;

const pool = new Pool({ //credentials stored in .env file
  user: process.env.DBUSER,
  host: process.env.DBHOST,
  database: process.env.DBDATABASE,
  password: process.env.DBPASSWORD,
})

// Returns the Query for "SELECT criteria FROM table WHERE field = term"
async function QuerySelect (criteria, table, field, term) {
  const client = await pool.connect()
  let res
  try {
    await client.query('BEGIN')
    try {
      res = await client.query("SELECT " + criteria + " FROM " + table + " WHERE " + field + " = '" + term + "'")
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  } finally {
    client.release()
  }
  return res
}

// Create entry in table using three variables "INSERT INTO table (field) VALUES value" - NOT CURRENTLY IN USE
async function QueryInsert (table, field, value) {
  const client = await pool.connect()
  let res
  try {
    await client.query('BEGIN')
    try {
      res = await client.query("INSERT INTO " + table + "(" + field + ") VALUES ('" + value + "')")
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  } finally {
    client.release()
  }
  console.log("Insert Result:" + res);
  return res
}

// Add a system to DB
async function AddSystem (name) {
  pool.query("INSERT INTO systems(name)VALUES('"+name+"')",(err, res) => {
      console.log("System added to DB: " + name);
      // console.log(err + res);
    }
  );
}

// Returns the Database ID (integer) for the system name requested
async function GetSysID (name) { 
  try {
    const { rows } = await QuerySelect("system_id", "systems", "name", name)
    return rows[0].system_id; // Return System_id
  } catch (err) {
    return 0; // Return 0 if system is not in the DB
  }
}

async function run() { 
  const sock = new zmq.Subscriber;

  sock.connect(SOURCE_URL);
  sock.subscribe('');
  console.log('EDDN listener connected to:', SOURCE_URL);

  for await (const [src] of sock) {
    msg = JSON.parse(zlib.inflateSync(src));
    if (msg.$schemaRef == "https://eddn.edcd.io/schemas/journal/1") { //only process correct schema
      const sysstate = msg.message.StationFaction?.FactionState;

      if (sysstate == targetstate) {
        console.log(`${msg.message.timestamp}: ${targetstate} detected in system: ${msg.message.StarSystem}`);

        if (await GetSysID(msg.message.StarSystem) == 0) { // Check if the system is in the DB
          await AddSystem(msg.message.StarSystem); // Add the System to DB
          console.log("System ID: " + await GetSysID(msg.message.StarSystem)); // Log the ID of the system added to DB


        } else {
          console.log(msg.message.StarSystem + " exists in DB");
        }
      }
    }
  }
}

run();