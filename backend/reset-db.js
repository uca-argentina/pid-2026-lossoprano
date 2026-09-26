const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env file
const loadEnvFile = () => {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#') && line.includes('=')) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');
        process.env[key.trim()] = value.trim();
      }
    });
  }
};

loadEnvFile();

const resetDatabase = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  // Parse the DATABASE_URL to get connection details
  const url = new URL(databaseUrl);
  const username = url.username;
  const password = url.password;
  const hostname = url.hostname;
  const port = url.port;
  const databaseName = url.pathname.substring(1); // Remove leading '/'

  console.log(`Resetting database: ${databaseName}`);
  console.log(`Host: ${hostname}:${port}`);
  console.log(`User: ${username}`);

  // Connect to the default 'postgres' database to be able to drop/create our target database
  const adminClient = new Client({
    user: username,
    host: hostname,
    database: 'postgres', // Connect to default postgres database
    password: password,
    port: port,
  });

  try {
    await adminClient.connect();
    console.log('Connected to postgres database');

    // Terminate all connections to the target database
    await adminClient.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();`);
    console.log(`Terminated existing connections to ${databaseName}`);

    // Drop the database if it exists
    await adminClient.query(`DROP DATABASE IF EXISTS "${databaseName}";`);
    console.log(`Dropped database ${databaseName} (if it existed)`);

    // Create the database
    await adminClient.query(`CREATE DATABASE "${databaseName}";`);
    console.log(`Created database ${databaseName}`);

    await adminClient.end();

    console.log('Database reset completed successfully!');
    console.log('You can now start your application and it will synchronize the schema.');

  } catch (error) {
    console.error('Error resetting database:', error.message);
    if (adminClient._connected) {
      await adminClient.end();
    }
    process.exit(1);
  }
};

resetDatabase();