const userService = require('./userService');

exports.createUser = async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: '유저 생성 실패' });
  }
};

exports.getUser = async (req, res) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: '유저 조회 실패' });
  }
};