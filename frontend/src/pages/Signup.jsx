
import { useState } from "react";

function Signup({ onSwitchToLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const response = await fetch(
        "http://localhost:5000/api/auth/signup",
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
    <div className="min-h-screen flex items-center justify-center bg-[#13141a] text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-gray-700 bg-[#1c1d27] p-8"
      >
        <h1 className="mb-2 text-3xl font-bold">Create Account</h1>
        <p className="mb-6 text-gray-400">
          Join The Sahakarya
        </p>

        <label className="mb-2 block">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-gray-600 bg-[#13141a] p-3 outline-none focus:border-purple-500"
          placeholder="Your name"
        />

        <label className="mb-2 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4 w-full rounded-lg border border-gray-600 bg-[#13141a] p-3 outline-none focus:border-purple-500"
          placeholder="you@example.com"
        />

        <label className="mb-2 block">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          className="mb-6 w-full rounded-lg border border-gray-600 bg-[#13141a] p-3 outline-none focus:border-purple-500"
          placeholder="At least 6 characters"
        />

        <button
          type="submit"
          className="w-full rounded-lg bg-purple-600 p-3 font-semibold hover:bg-purple-500"
        >
          Sign Up
        </button>

        <p className="mt-5 text-center text-gray-400">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-purple-400 hover:text-purple-300"
          >
            Login
          </button>
        </p>
      </form>
    </div>
  );
}

export default Signup;
