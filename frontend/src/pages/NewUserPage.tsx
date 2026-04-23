import { useState, type FormEvent } from "react";
import {
  createUserApi,
  type CreateUserRequest,
} from "../services/admin.api";

type UserRole = CreateUserRequest["role"];

export default function NewUserPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [extension, setExtension] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("agent");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sipPassword, setSipPassword] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = () => {
    if (!name || !username || !extension || !password || !confirmPassword) {
      return "All required fields must be filled";
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return "Username must be lowercase alphanumeric with underscore only";
    }

    if (!/^\d{3,6}$/.test(extension)) {
      return "Extension must be 3–6 digits only";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match";
    }

    if (!["admin", "agent", "user"].includes(role)) {
      return "Invalid role selected";
    }

    return null;
  };

  const mapBackendError = (err: any) => {
    const code = String(err?.response?.data?.error || "").trim();

    switch (code) {
      case "username-exists":
        return "Username already exists";
      case "email-exists":
        return "Email already exists";
      case "missing-required-fields":
        return "Missing required fields (backend validation failed)";
      case "invalid-extension":
        return "Extension must be 3-6 digits only";
      case "invalid-role":
        return "Invalid role sent to server";
      case "forbidden":
        return "You are not allowed to create users";
      case "missing-token":
      case "invalid-token":
        return "Your session expired. Please login again";
      default:
        if (err?.response?.status >= 500) {
          return "Server error while creating user";
        }
        return code || err?.message || "Failed to create user";
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage("");

    const error = validate();
    if (error) {
      setMessage(error);
      return;
    }

    setLoading(true);

    try {
      const payload: CreateUserRequest = {
        name,
        username,
        extension,
        email: email || "",
        password,
        role,
        sipPassword: sipPassword || password,
      };

      const res = await createUserApi(payload);

      console.log("[CREATE USER SUCCESS]", res.data);

      setMessage("User created successfully");

      setName("");
      setUsername("");
      setExtension("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setSipPassword("");
      setRole("agent");
    } catch (err: any) {
      console.error("[CREATE USER ERROR]", err);
      setMessage(mapBackendError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 500 }}>
      <h2>Create SIP User</h2>

      <form onSubmit={onSubmit}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="Username (lowercase)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="Extension (e.g. 1001)"
          value={extension}
          onChange={(e) => setExtension(e.target.value)}
          style={inputStyle}
        />

        <input
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          style={inputStyle}
        >
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          style={inputStyle}
        />

        <input
          type="password"
          placeholder="SIP Password (optional)"
          value={sipPassword}
          onChange={(e) => setSipPassword(e.target.value)}
          style={inputStyle}
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>

      {message && <p style={{ marginTop: 10 }}>{message}</p>}
    </div>
  );
}

const inputStyle = {
  display: "block",
  marginBottom: 10,
  width: "100%",
  padding: 10,
};

const buttonStyle = {
  padding: 10,
  width: "100%",
};
