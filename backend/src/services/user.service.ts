import * as userRepository from "../repositories/user.repository";

export async function createUser(data: {
  name?: string;
  phone?: string;
  pushToken?: string;
}) {
  return userRepository.createUser(data);
}