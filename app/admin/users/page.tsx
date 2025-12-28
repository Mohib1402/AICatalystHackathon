'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface BlockedUser {
  userId: string;
  blockedUntil: number;
  attackCount: number;
}

interface BlockedIP {
  ip: string;
  blockedUntil: number;
  attackCount: number;
}

export default function UsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchBlockedUsers();
    const interval = setInterval(fetchBlockedUsers, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchBlockedUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch users');

      const data = await response.json();
      setBlockedUsers(data.blockedUsers);
      setBlockedIPs(data.blockedIPs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'unblock', userId }),
      });

      if (response.ok) {
        await fetchBlockedUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const unblockIP = async (ip: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'unblock', ip }),
      });

      if (response.ok) {
        await fetchBlockedUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimeRemaining = (blockedUntil: number) => {
    const remaining = Math.max(0, blockedUntil - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/admin/login');
      }
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Blocked Users & IPs</h1>
            <div className="flex items-center gap-4">
              <a href="/admin" className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                ← Back to Dashboard
              </a>
              <button
                onClick={handleLogout}
                className="text-sm font-medium bg-red-600/20 border border-red-500/30 text-red-300 px-4 py-2 rounded-lg hover:bg-red-600/30 hover:border-red-500/50 transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Blocked Users */}
        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-4">Blocked Users ({blockedUsers.length})</h2>
          {loading ? (
            <div className="bg-slate-800/50 rounded-lg shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : blockedUsers.length === 0 ? (
            <div className="bg-slate-800/50 rounded-lg shadow-md p-12 text-center">
              <span className="text-6xl">✅</span>
              <p className="mt-4 text-slate-400 font-medium">No blocked users</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-lg shadow-md border border-slate-700/50 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">User ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Attack Count</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Time Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blockedUsers.map((user) => (
                    <tr key={user.userId} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-100">{user.userId}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold">
                          {user.attackCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-orange-700">
                        {formatTimeRemaining(user.blockedUntil)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => unblockUser(user.userId)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Blocked IPs */}
        <div>
          <h2 className="text-lg font-bold text-slate-100 mb-4">Blocked IP Addresses ({blockedIPs.length})</h2>
          {loading ? (
            <div className="bg-slate-800/50 rounded-lg shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
          ) : blockedIPs.length === 0 ? (
            <div className="bg-slate-800/50 rounded-lg shadow-md p-12 text-center">
              <span className="text-6xl">✅</span>
              <p className="mt-4 text-slate-400 font-medium">No blocked IPs</p>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-lg shadow-md border border-slate-700/50 overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-800/50 border-b border-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">IP Address</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Attack Count</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Time Remaining</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {blockedIPs.map((blockedIP) => (
                    <tr key={blockedIP.ip} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-slate-100">{blockedIP.ip}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold">
                          {blockedIP.attackCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-orange-700">
                        {formatTimeRemaining(blockedIP.blockedUntil)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => unblockIP(blockedIP.ip)}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
