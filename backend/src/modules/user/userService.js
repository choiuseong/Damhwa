const { User } = require('../../models');

exports.createUser = async (data) => {
  return await User.create(data);
};

exports.getUserById = async (id) => {
  return await User.findByPk(id);
};