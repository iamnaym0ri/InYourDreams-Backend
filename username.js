// usernameRoutes.js
import express from 'express';
import { createUser, getUser } from './db.js';

const router = express.Router();

router.post('/api/username', async (req, res) => {
  const { username } = req.body;

  if (!username || username.trim() === '') {
    console.log("no username!");
    return res.status(400).json({ error: 'Username is required' });
  }


  try {
    const newUser = await createUser(username.trim());
    res.status(200).json({ success: true, user: newUser });
    console.log(`Username created: ${newUser}`);
  } catch (err) {
    console.log("point of failure"); 
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/api/username/:username', async (req, res) => {
  try {
    const user = await getUser(req.params.username.trim());
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.status(200).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
