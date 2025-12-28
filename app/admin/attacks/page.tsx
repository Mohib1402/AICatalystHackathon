'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Attack {
  id: string;
  timestamp: string;
  userId: string;
  ip: string;
  prompt: string;
  riskScore: number;
  riskLevel: string;
  blocked: boolean;
  detectedPatterns: number;
  attackCategories: string[];
  reasoning: string[];
  aiAnalysis?: {
    summary: string;
    attackType: string;
    severity: string;
    mitigationSteps: string[];
  };
}

export default function AttacksPage() {
  const [attacks, setAttacks] = useState<Attack[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAttack, setSelectedAttack] = useState<Attack | null>(null);
  const [filter, setFilter] = useState<'all' | 'blocked' | 'allowed'>('all');
  const router = useRouter();

  useEffect(() => {
    fetchAttacks();
  }, [filter]);

  const fetchAttacks = async () => {
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: '0',
      });

      if (filter === 'blocked') params.append('blocked', 'true');
      if (filter === 'allowed') params.append('blocked', 'false');

      const response = await fetch(`/api/admin/attacks?${params}`, {
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch attacks');

      const data = await response.json();
      setAttacks(data.attacks);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
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
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Attack Log</h1>
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="mb-6 flex items-center gap-4">
          <span className="text-sm font-medium text-slate-300">Filter:</span>
          <div className="flex gap-2">
            {(['all', 'blocked', 'allowed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  filter === f
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg'
                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700/50'
                }`}
              >
                {f === 'all' ? 'All Attacks' : f === 'blocked' ? 'Blocked Only' : 'Allowed Only'}
              </button>
            ))}
          </div>
          <span className="ml-auto text-sm text-slate-400">
            {total} total attack{total !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Attacks Table */}
        {loading ? (
          <div className="bg-slate-800/50 rounded-lg shadow-md p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-4 text-slate-400">Loading attacks...</p>
          </div>
        ) : attacks.length === 0 ? (
          <div className="bg-slate-800/50 rounded-lg shadow-md p-12 text-center">
            <span className="text-6xl">🎉</span>
            <p className="mt-4 text-slate-400 font-medium">No attacks found</p>
          </div>
        ) : (
          <div className="bg-slate-800/50 rounded-lg shadow-md border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-800/50 border-b border-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">User/IP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Prompt</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attacks.map((attack) => (
                  <tr key={attack.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400">{formatTime(attack.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold ${
                          attack.riskScore >= 76
                            ? 'bg-red-100 text-red-800'
                            : attack.riskScore >= 51
                            ? 'bg-orange-100 text-orange-800'
                            : attack.riskScore >= 26
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {attack.riskScore}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {attack.attackCategories.slice(0, 2).join(', ') || 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      <div>{attack.userId}</div>
                      <div className="text-slate-400">{attack.ip}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 max-w-xs truncate">
                      {attack.prompt}
                    </td>
                    <td className="px-4 py-3">
                      {attack.blocked ? (
                        <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                          🚫 Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          ✅ Allowed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedAttack(attack)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Details →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Attack Details Modal */}
      {selectedAttack && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-slate-700/50">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700/50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-100">Attack Details</h2>
              <button
                onClick={() => setSelectedAttack(null)}
                className="text-slate-400 hover:text-slate-300 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-3">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">Timestamp:</span>
                    <p className="font-medium text-slate-100">{formatTime(selectedAttack.timestamp)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Risk Score:</span>
                    <p className="font-mono font-bold text-2xl text-red-400">{selectedAttack.riskScore}/100</p>
                  </div>
                  <div>
                    <span className="text-slate-400">User ID:</span>
                    <p className="font-mono text-slate-100">{selectedAttack.userId}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">IP Address:</span>
                    <p className="font-mono text-slate-100">{selectedAttack.ip}</p>
                  </div>
                </div>
              </div>

              {/* Prompt */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Original Prompt</h3>
                <div className="bg-slate-800 border border-slate-700/50 rounded-lg p-4">
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedAttack.prompt}</p>
                </div>
              </div>

              {/* Detection Details */}
              <div>
                <h3 className="text-sm font-semibold text-slate-300 mb-2">Detection Details</h3>
                <div className="bg-gradient-to-br from-yellow-900/20 to-orange-900/20 border border-yellow-700/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-300">Patterns Detected:</span>
                    <span className="font-bold text-yellow-400">{selectedAttack.detectedPatterns}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-300">Attack Categories:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedAttack.attackCategories.map((cat, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/20 text-red-300 border border-red-500/30 rounded text-xs font-medium">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-300 block mb-1">Reasoning:</span>
                    <ul className="space-y-1 pl-4">
                      {selectedAttack.reasoning.map((reason, i) => (
                        <li key={i} className="text-xs text-slate-300">• {reason}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* AI Analysis */}
              {selectedAttack.aiAnalysis && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">🤖 AI Analysis</h3>
                  <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border border-blue-700/30 rounded-lg p-4 space-y-3">
                    <div>
                      <span className="text-sm font-medium text-slate-300">Attack Type:</span>
                      <p className="text-sm font-bold text-blue-300">{selectedAttack.aiAnalysis.attackType}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-slate-300">Summary:</span>
                      <p className="text-sm text-slate-300 mt-1">{selectedAttack.aiAnalysis.summary}</p>
                    </div>
                    {selectedAttack.aiAnalysis.mitigationSteps.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-slate-300">Mitigation Steps:</span>
                        <ol className="mt-1 space-y-1 pl-4">
                          {selectedAttack.aiAnalysis.mitigationSteps.map((step, i) => (
                            <li key={i} className="text-xs text-slate-300">{i + 1}. {step}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
