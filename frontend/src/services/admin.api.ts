import api from "./api";

export interface CreateUserRequest {
  name: string;
  username: string;
  extension: string;
  email?: string | null;
  password: string;
  role: "admin" | "agent" | "user";
  sipPassword?: string;
}

export interface CreateUserResponse {
  user: {
    id: string;
    name?: string;
    username: string;
    email?: string;
    extension: string;
    role: "admin" | "agent" | "user";
  };
}

export const createUserApi = (data: CreateUserRequest) => {
  return api.post<CreateUserResponse>("/admin/users", data);
};
