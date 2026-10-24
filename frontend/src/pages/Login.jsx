
import { useState } from "react";

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
    <div className="min-h-screen flex items-center justify-center bg-[#13141a] text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-700 bg-[#1c1d27] p-8"
      >
        <h1 className="mb-2 text-3xl font-bold">
          Welcome Back
        </h1>

        <p className="mb-6 text-gray-400">
          Sign in to The Sahakarya
        </p>

        <label className="mb-2 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
          className="mb-5 w-full rounded-lg border border-gray-600 bg-[#13141a] p-3 outline-none focus:border-purple-500"
        />

        <label className="mb-2 block">Password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          required
          className="mb-6 w-full rounded-lg border border-gray-600 bg-[#13141a] p-3 outline-none focus:border-purple-500"
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-purple-600 p-3 font-semibold hover:bg-purple-500"
        >
          Login
        </button>
        <p className="mt-5 text-center text-gray-400">
  Don't have an account?{" "}
  <button
    type="button"
    onClick={onSwitchToSignup}
    className="text-purple-400 hover:text-purple-300"
  >
    Sign up
  </button>
</p>
      </form>
    </div>
  );
}

export default Login;
