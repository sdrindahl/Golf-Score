export const dynamic = 'force-dynamic';
"use client";

import { useState, useEffect, FormEvent } from "react";
import { useTheme } from "@/lib/themeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, FormEvent } from "react";
import { useTheme } from "@/lib/themeContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import PageWrapper from "@/components/PageWrapper";
import { User } from "@/types";
import { useAuth } from "@/lib/useAuth";
import PageWrapper from "@/components/PageWrapper";
import { User } from "@/types";

type VersionInfo = { version: string; buildDate: string; buildTime?: string };

export default function Settings() {
  // Theme selector
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const auth = useAuth();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [newName, setNewName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setCurrentUser(user);
    setNewName(user.name);
    setLoading(false);
    fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => setVersion(data))
      .catch(() => {});
  }, [router]);

  const handleUpdateName = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNameError("");
    setNameSuccess("");
    if (!newName.trim()) return setNameError("Please enter a name");
    if (newName === currentUser?.name) return setNameError("New name must be different");
    const allUsers = auth.getAllUsers();
    if (allUsers.some((u: User) => u.name.toLowerCase() === newName.toLowerCase() && u.id !== currentUser?.id)) return setNameError("This name is already taken");
    try {
      if (!currentUser) return;
      auth.updateName(currentUser.id, newName);
      setCurrentUser({ ...currentUser, name: newName });
      setNameSuccess("Name updated successfully!");
    } catch (err: any) {
      setNameError(err.message);
    }
  };

  const handleChangePassword = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (!currentPassword || !newPassword || !confirmPassword) return setPasswordError("Please fill in all fields");
    if (currentPassword !== currentUser?.password) return setPasswordError("Current password is incorrect");
    if (newPassword.length !== 4 || !/^\d{4}$/.test(newPassword)) return setPasswordError("New password must be exactly 4 digits");
    if (newPassword !== confirmPassword) return setPasswordError("New passwords do not match");
    if (newPassword === currentPassword) return setPasswordError("New password must be different");
    try {
      if (!currentUser) return;
      auth.updatePassword(currentUser.id, newPassword);
      setCurrentUser({ ...currentUser, password: newPassword });
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
    try {
      setDeleteError("");
      if (!currentUser) return;
      await auth.deleteUser(currentUser.id);
      router.push("/login");
    } catch (err: any) {
      setDeleteError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    router.push("/login");
  };

  if (loading) {
    return (
      <PageWrapper title="Account Settings">
        <div className="max-w-2xl mx-auto bg-white/95 backdrop-blur rounded-3xl p-8 shadow-lg text-center border border-white/20">
          <p className="text-gray-500">Loading...</p>
        </div>
      </PageWrapper>
    );
  }
  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col pb-24">
      <PageWrapper title="Account Settings">
        <div className="max-w-xl mx-auto space-y-4">
          {/* Theme Selector */}
          <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20">
            <h2 className="text-lg font-bold mb-2 text-gray-800">Theme</h2>
            <div className="flex gap-3 mt-2">
              <button
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors border-2 ${theme === 'light' ? 'bg-[var(--accent-color)] text-white border-[var(--accent-color)]' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                onClick={() => setTheme('light')}
              >
                iOS Light
              </button>
              <button
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors border-2 ${theme === 'wolves' ? '' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                style={theme === 'wolves' ? {
                  background: 'linear-gradient(120deg, #0a1833 0%, #00ff87 60%, #00cfff 100%)',
                  color: '#fff',
                  borderColor: '#00ff87',
                  boxShadow: '0 2px 8px rgba(0,255,135,0.15)'
                } : {}}
                onClick={() => setTheme('wolves')}
              >
                MN TWolves
              </button>
              <button
                className={`flex-1 py-2 rounded-lg font-semibold transition-colors border-2 ${theme === 'vikings' ? '' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                style={theme === 'vikings' ? {
                  background: 'linear-gradient(120deg, #4f2683 0%, #ffc62f 60%, #ffffff 100%)',
                  color: '#4f2683',
                  borderColor: '#ffc62f',
                  boxShadow: '0 2px 8px rgba(79,38,131,0.15)'
                } : {}}
                onClick={() => setTheme('vikings')}
              >
                MN Vikings
              </button>
            </div>
          </div>
          <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-lg text-gray-800">{currentUser.name}</div>
              {!editingName && (
                <button onClick={() => { setEditingName(true); setNameError(""); setNameSuccess(""); }} className="text-blue-600 hover:text-blue-800 text-sm font-semibold">Edit</button>
              )}
            </div>
            {editingName && (
              <form onSubmit={handleUpdateName} className="mt-4 pt-4 border-t space-y-3">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter new name" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-sm" />
                {nameError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold">{nameError}</div>}
                {nameSuccess && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-semibold">✅ {nameSuccess}</div>}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">Save</button>
                  <button type="button" onClick={() => setEditingName(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-colors text-sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
          <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20">
            {!showPasswordForm ? (
              <button onClick={() => { setShowPasswordForm(true); setPasswordError(""); setPasswordSuccess(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }} className="w-full text-left text-base font-bold text-gray-800 hover:text-blue-600">🔒 Change Password</button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input type={showPassword ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value.slice(0, 4))} placeholder="Current Password" maxLength={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono" />
                <input type={showPassword ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value.slice(0, 4))} placeholder="New Password" maxLength={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono" />
                <input type={showPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.slice(0, 4))} placeholder="Confirm Password" maxLength={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-600 text-xs">{showPassword ? "Hide" : "Show"} Password</button>
                {passwordError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold">{passwordError}</div>}
                {passwordSuccess && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-semibold">✅ {passwordSuccess}</div>}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">Save</button>
                  <button type="button" onClick={() => setShowPasswordForm(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-colors text-sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
          <button onClick={handleLogout} className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20">🚪 Logout</button>
          {currentUser.is_admin && (
            <div className="bg-red-50 backdrop-blur rounded-3xl p-6 shadow-lg border-2 border-red-200">
              <h2 className="text-lg font-bold mb-2 text-red-600">⚠️ Delete Account</h2>
              <p className="text-gray-600 text-xs mb-4">Permanently delete an account and all golf rounds.</p>
              {deleteError && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-3 text-xs font-semibold">{deleteError}</div>}
              <button onClick={handleDeleteAccount} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors">🗑️ Delete Account</button>
            </div>
          )}
          <Link href="/">
            <button className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20 mt-6">← Back to Home</button>
          </Link>
          {version && (
            <div className="text-center text-xs text-black font-bold py-4">
              <p>Current version: {version.version}</p>
              <p>
                Deployed {new Date(version.buildDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                {version.buildTime && ` at ${new Date(`2026-01-01T${version.buildTime}`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`}
              </p>
            </div>
          )}
        </div>
      </PageWrapper>
      <nav className="ios-bottom-nav fixed bottom-0 left-0 right-0 z-50">
        <button onClick={() => router.push("/")} className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">🏌️</span>
          <span className="text-xs">Home</span>
        </button>
        <button onClick={() => router.push("/courses") } className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">⛳</span>
          <span className="text-xs">Courses</span>
        </button>
        <button onClick={() => router.push("/players") } className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">👥</span>
          <span className="text-xs">Golfers</span>
        </button>
        <button onClick={() => router.push("/settings") } className="flex flex-col items-center text-[var(--accent-color)] focus:outline-none">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">Settings</span>
        </button>
      </nav>
    </div>
  );
}
