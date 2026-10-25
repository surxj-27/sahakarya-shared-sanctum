
import { useState } from "react";
import AuthLayout from "../components/AuthLayout";

function Login({ onSwitchToSignup, onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  
async function handleSubmit(event) {
  event.preventDefault();

  try {
    const response = await fetch(
      "http://localhost:5000/api/auth/login",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem("token", data.token);
localStorage.setItem("user", JSON.stringify(data.user));

onLoginSuccess();
  } catch (error) {
    alert(error.message);
  }
}


  return (
    <AuthLayout
      eyebrow="welcome back"
      title={<>Good ideas start <span className="underline-doodle">here.</span></>}
    >
      <p className="auth-description">Sign in to The Sahakarya</p>
      <form
        onSubmit={handleSubmit}
        className="auth-form"
      >
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          required
        />

        <button
          type="submit"
          className="btn btn-dark auth-submit"
        >
          Login
        </button>
        <p className="auth-switch">
  Don't have an account?{" "}
  <button
    type="button"
    onClick={onSwitchToSignup}
  >
    Sign up
  </button>
</p>
      </form>
    </AuthLayout>
  );
}

export default Login;
