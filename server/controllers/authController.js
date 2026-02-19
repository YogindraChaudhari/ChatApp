const TLSSigAPIv2 = require('tls-sig-api-v2');


const generateUserSig = (req, res) => {
  const SDKAPPID = parseInt(process.env.TENCENT_SDK_APP_ID || 0);
  const SECRETKEY = process.env.TENCENT_SECRET_KEY || '';

  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  if (!SDKAPPID || !SECRETKEY) {
     return res.status(500).json({ error: 'Server configuration error (Missing Tencent keys)' });
  }

  try {
    const api = new TLSSigAPIv2.Api(SDKAPPID, SECRETKEY);
    const userSig = api.genUserSig(userId, 86400*7); // 7 days expiry
    res.json({ userSig, sdkAppId: SDKAPPID });
  } catch (error) {
    console.error('Error generating UserSig:', error);
    res.status(500).json({ error: 'Failed to generate UserSig' });
  }
};

module.exports = {
  generateUserSig
};
