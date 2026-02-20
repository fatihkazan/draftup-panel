"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function signUp() {
    setStatus("Signing up...");
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({ email, password });
    
    setLoading(false);
    
    if (error) {
      setStatus("SIGNUP ERROR: " + error.message);
      return;
    }
    setStatus("Signup OK. Now login.");
  }

  async function login() {
    if (!email || !password) {
      setStatus("Please enter email and password");
      return;
    }

    setStatus("Logging in...");
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    setLoading(false);
    
    if (error) {
      setStatus("LOGIN ERROR: " + error.message);
      return;
    }
    
    if (data.session) {
      setStatus("Success! Redirecting...");
      
      // Cookie'lerin kaydedilmesi için biraz bekle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Tam sayfa yenileme
      window.location.href = "/clients";
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setStatus("Logged out.");
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-md px-6 py-12">
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="mt-2 text-zinc-300">Email + password</p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <input
            type="password"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && login()}
            disabled={loading}
          />

          <button
            onClick={login}
            disabled={loading}
            className="w-full rounded-lg bg-white px-4 py-2 text-sm text-zinc-900 hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Login"}
          </button>

          <button
            onClick={signUp}
            disabled={loading}
            className="w-full rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            Sign up
          </button>

          <button
            onClick={logout}
            disabled={loading}
            className="w-full rounded-lg bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700 disabled:opacity-50"
          >
            Logout
          </button>

          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            <div className="text-zinc-300">Status</div>
            <div className="mt-1 font-mono">{status}</div>
          </div>
        </div>
      </div>
    </div>
  );
}