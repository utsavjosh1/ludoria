import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

console.log('Testing database connection...');
console.log('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@')); // Hide password

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000, // 10 second timeout
});

async function testConnection() {
  try {
    console.log('Attempting to connect...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT NOW()');
    console.log('✅ Query test successful:', result.rows[0]);
    
    await client.end();
    console.log('✅ Connection closed');
  } catch (error: any) {
    console.error('❌ Connection failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error);
  }
}

testConnection();