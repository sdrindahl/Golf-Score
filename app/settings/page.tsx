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
  const [inProgressRounds, setInProgressRounds] = useState<any[]>([]);
  const [loadingRounds, setLoadingRounds] = useState(false);
  const [deleteRoundError, setDeleteRoundError] = useState("");
  const [deletingRoundId, setDeletingRoundId] = useState<string | null>(null);

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
        <div className="max-w-2xl mx-auto bg-black bg-opacity-70 rounded-3xl p-8 shadow-2xl text-center border border-green-400">
          <p className="text-green-400">Loading...</p>
        </div>
      </PageWrapper>
    );
  }
  if (!currentUser) return null;

  async function handleUpdateName(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNameError("");
    setNameSuccess("");
    if (!newName.trim()) {
      setNameError("Name cannot be empty.");
      return;
    }
    if (!currentUser) return;
    try {
      await auth.updateName(currentUser.id, newName.trim());
      setNameSuccess("Name updated successfully!");
      setCurrentUser({ ...currentUser, name: newName.trim() });
      setEditingName(false);
    } catch (err: any) {
      setNameError(err.message || "Failed to update name.");
    }
  }
  function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // ...implement password change logic...
  }
  function handleLogout() {
    auth.logoutUser();
    router.push('/login');
  }
  function handleDeleteAccount() {
    // ...implement delete account logic...
  }

  async function loadInProgressRounds() {
    setLoadingRounds(true);
    setDeleteRoundError("");
    try {
      const res = await fetch('/api/admin-rounds-in-progress');
      if (!res.ok) throw new Error('Failed to load rounds');
      const data = await res.json();
      setInProgressRounds(data.rounds || []);
    } catch (err: any) {
      setDeleteRoundError(err.message || 'Failed to load rounds');
    } finally {
      setLoadingRounds(false);
    }
  }

  async function handleDeleteRound(roundId: string) {
    setDeletingRoundId(roundId);
    setDeleteRoundError("");
    try {
      const res = await fetch('/api/delete-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setInProgressRounds(prev => prev.filter(r => r.id !== roundId));
    } catch (err: any) {
      setDeleteRoundError(err.message || 'Delete failed');
    } finally {
      setDeletingRoundId(null);
    }
  }

  return (
    <div className="min-h-screen flex flex-col pb-24">
      <PageWrapper title="Account Settings">
        <div className="max-w-xl mx-auto space-y-4">
          {currentUser.is_admin && (
            <div className="flex flex-col gap-4">
              <Link href="/themes">
                <button className="w-full bg-black bg-opacity-70 border border-green-400 text-green-400 font-semibold py-3 rounded-2xl shadow-2xl hover:bg-green-900 hover:text-white transition-all">🎨 Themes</button>
              </Link>
            </div>
          )}
          <div className="bg-black bg-opacity-70 rounded-3xl p-6 shadow-2xl border border-green-400 mt-6">
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-lg text-green-400">{currentUser.name}</div>
              {!editingName && (
                <button
                  onClick={() => {
                    setEditingName(true);
                    setNameError("");
                    setNameSuccess("");
                    setNewName(currentUser.name);
                  }}
                  className="text-blue-500 hover:text-blue-700 text-sm font-semibold"
                >
                  Edit
                </button>
              )}
            </div>
            {editingName && (
              <form onSubmit={handleUpdateName} className="mt-4 pt-4 border-t border-green-900 space-y-3">
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Enter new name" className="w-full px-3 py-2 border border-green-400 rounded-lg focus:outline-none focus:border-green-500 text-sm bg-black bg-opacity-60 text-green-200" />
                {nameError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold">{nameError}</div>}
                {nameSuccess && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-semibold">✅ {nameSuccess}</div>}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">Save</button>
                  <button type="button" onClick={() => setEditingName(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-colors text-sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
          <div className="bg-black bg-opacity-70 rounded-3xl p-6 shadow-2xl border border-green-400 mt-6">
            {!showPasswordForm ? (
              <button onClick={() => { setShowPasswordForm(true); setPasswordError(""); setPasswordSuccess(""); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); }} className="w-full text-left text-base font-bold text-green-400 hover:text-white">🔒 Change Password</button>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <input type={showPasswordForm ? "text" : "password"} value={currentPassword} onChange={e => setCurrentPassword(e.target.value.slice(0, 4))} placeholder="Current Password" maxLength={4} className="w-full px-3 py-2 border border-green-400 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono bg-black bg-opacity-60 text-green-200" />
                <input type={showPasswordForm ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value.slice(0, 4))} placeholder="New Password" maxLength={4} className="w-full px-3 py-2 border border-green-400 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono bg-black bg-opacity-60 text-green-200" />
                <input type={showPasswordForm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value.slice(0, 4))} placeholder="Confirm Password" maxLength={4} className="w-full px-3 py-2 border border-green-400 rounded-lg focus:outline-none focus:border-green-500 text-center text-lg tracking-widest font-mono bg-black bg-opacity-60 text-green-200" />
                <button type="button" onClick={() => setShowPasswordForm(!showPasswordForm)} className="text-green-400 text-xs">{showPasswordForm ? "Hide" : "Show"} Password</button>
                {passwordError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-semibold">{passwordError}</div>}
                {passwordSuccess && <div className="bg-green-100 text-green-700 p-3 rounded-lg text-xs font-semibold">✅ {passwordSuccess}</div>}
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">Save</button>
                  <button type="button" onClick={() => setShowPasswordForm(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 rounded-lg transition-colors text-sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
          <button onClick={handleLogout} className="w-full bg-black bg-opacity-70 border border-green-400 text-green-400 font-semibold py-3 rounded-2xl shadow-2xl hover:bg-green-900 hover:text-white transition-all mt-6">🚪 Logout</button>
          {currentUser.is_admin && (
            <div className="bg-black bg-opacity-70 rounded-3xl p-6 shadow-2xl border-2 border-red-400 mt-6">
              <h2 className="text-lg font-bold mb-2 text-red-400">⚠️ Delete Account</h2>
              <p className="text-gray-300 text-xs mb-4">Permanently delete an account and all golf rounds.</p>
              {deleteError && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-3 text-xs font-semibold">{deleteError}</div>}
              <button onClick={handleDeleteAccount} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg transition-colors">🗑️ Delete Account</button>
            </div>
          )}
          {currentUser.is_admin && (
            <div className="bg-black bg-opacity-70 rounded-3xl p-6 shadow-2xl border-2 border-orange-400 mt-6">
              <h2 className="text-lg font-bold mb-3 text-orange-400">🔴 Manage In-Progress Rounds</h2>
              <p className="text-gray-300 text-xs mb-4">Delete stuck or abandoned live rounds for any player.</p>
              {deleteRoundError && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-3 text-xs font-semibold">{deleteRoundError}</div>}
              <button
                onClick={loadInProgressRounds}
                disabled={loadingRounds}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded-lg transition-colors mb-3 disabled:opacity-50"
              >
                {loadingRounds ? 'Loading...' : '🔄 Load In-Progress Rounds'}
              </button>
              {inProgressRounds.length > 0 && (
                <div className="flex flex-col gap-2">
                  {inProgressRounds.map((round: any) => (
                    <div key={round.id} className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3 border border-orange-800">
                      <div>
                        <div className="text-white font-semibold text-sm">{round.user_name || round.userName || '(unknown)'}</div>
                        <div className="text-gray-400 text-xs">{round.course_name || round.courseName || round.course_id || 'Unknown course'}</div>
                        <div className="text-gray-500 text-xs">{round.date ? new Date(round.date).toLocaleDateString() : ''}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteRound(round.id)}
                        disabled={deletingRoundId === round.id}
                        className="ml-3 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {deletingRoundId === round.id ? '...' : '🗑️ Delete'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {inProgressRounds.length === 0 && !loadingRounds && (
                <p className="text-gray-500 text-xs text-center">No rounds loaded yet. Click the button above.</p>
              )}
            </div>
          )}
          {version && (
            <div className="text-center text-xs mt-6">
              <div className="text-black font-bold">Version: {version.version}</div>
              <div className="text-black font-bold">Build Date: {version.buildDate}{version.buildTime ? `, ${version.buildTime}` : ''}</div>
            </div>
          )}
        </div>
      </PageWrapper>
    </div>
  );
}
