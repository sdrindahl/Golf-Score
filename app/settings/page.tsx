"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/useAuth";
import PageWrapper from "../../components/PageWrapper";
import { User } from "../../types";

type VersionInfo = { version: string; buildDate: string; buildTime?: string };

export default function Settings() {
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
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setVersion(data))
      .catch(() => {});
  }, [router]);

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

  function handleUpdateName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // ...implement name update logic...
  }
  function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // ...implement password change logic...
  }
  function handleLogout() {
    // ...implement logout logic...
  }
  function handleDeleteAccount() {
    // ...implement delete account logic...
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col pb-24">
      <PageWrapper title="Account Settings">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="flex flex-col gap-4">
            <Link href="/themes">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-2xl shadow-lg transition-all">🎨 Themes</button>
            </Link>
          </div>
          <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20 mt-6">
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
          <div className="bg-white/95 backdrop-blur rounded-3xl p-6 shadow-lg border border-white/20 mt-6">
            {!showPasswordForm ? (
              <button onClick={() => { setShowPasswordForm(true); setPasswordError(""); setPasswordSuccess(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }} className="w-full text-left text-base font-bold text-gray-800 hover:text-blue-600">🔒 Change Password</button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input type={showPasswordForm ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value.slice(0, 4))} placeholder="Current Password" maxLength={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono" />
                <input type={showPasswordForm ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value.slice(0, 4))} placeholder="New Password" maxLength={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono" />
                <input type={showPasswordForm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.slice(0, 4))} placeholder="Confirm Password" maxLength={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono" />
                <button type="button" onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-gray-600 text-xs">{showPasswordForm ? "Hide" : "Show"} Password</button>
                {passwordError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold">{passwordError}</div>}
                {passwordSuccess && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-semibold">✅ {passwordSuccess}</div>}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">Save</button>
                  <button type="button" onClick={() => setShowPasswordForm(false)} className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2 rounded-lg transition-colors text-sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
          <button onClick={handleLogout} className="w-full bg-white/90 hover:bg-white text-green-700 font-semibold py-3 rounded-2xl shadow-lg hover:shadow-xl transition-all border border-white/20 mt-6">🚪 Logout</button>
          {currentUser.is_admin && (
            <div className="bg-red-50 backdrop-blur rounded-3xl p-6 shadow-lg border-2 border-red-200 mt-6">
              <h2 className="text-lg font-bold mb-2 text-red-600">⚠️ Delete Account</h2>
              <p className="text-gray-600 text-xs mb-4">Permanently delete an account and all golf rounds.</p>
              {deleteError && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-3 text-xs font-semibold">{deleteError}</div>}
              <button onClick={handleDeleteAccount} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors">🗑️ Delete Account</button>
            </div>
          )}
          {version && (
            <div className="text-center text-xs text-gray-400 mt-6">
              <div>Version: {version.version}</div>
              <div>Build Date: {version.buildDate}{version.buildTime ? `, ${version.buildTime}` : ''}</div>
            </div>
          )}
        </div>
      </PageWrapper>
    </div>
  );
}
