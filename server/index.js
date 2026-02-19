const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
// const { createClient } = require('@supabase/supabase-js'); // Unused
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api', authRoutes);

// Basic health check
app.get('/', (req, res) => {
  res.send('NexusChat Server Running');
});

// Startup Config Check
const SDKAPPID = process.env.TENCENT_SDK_APP_ID;
const SECRETKEY = process.env.TENCENT_SECRET_KEY;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  if (!SDKAPPID || !SECRETKEY) {
      console.warn("WARNING: Tencent SDK App ID or Secret Key is missing in .env file. Real-time features will not work.");
  } else {
      console.log(`Tencent SDK Configured)`);
  }
});
