
import { useState } from "react";
import AuthLayout from "../components/AuthLayout";
import { API_URL } from "../config";

function Signup({ onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await fetch(
        `${API_URL}/auth/signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, password }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Signup failed");
      }

      alert("Account created successfully!");
      onSwitchToLogin();
    } catch (error) {
      alert(error.message);
    }
  }

  return (
    <AuthLayout
      eyebrow="come on in"
      title={<>Make room for a <span className="underline-doodle">new idea.</span></>}
    >
      <p className="auth-description">Join The Sahakarya</p>
      <form
        onSubmit={handleSubmit}
        className="auth-form"
      >
        <label>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Your name"
        />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@example.com"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          placeholder="At least 6 characters"
        />

        <button
          type="submit"
          className="btn btn-dark auth-submit"
        >
          Sign Up
        </button>

        <p className="auth-switch">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
          >
            Login
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}

export default Signup;
