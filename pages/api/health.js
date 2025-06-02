export default function handler(req, res) {
  res.status(200).json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'STEMuiz API is running'
  });
} 