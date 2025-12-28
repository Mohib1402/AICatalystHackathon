'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SecurityStats {
  totalAttacks: number;
  attacksBlocked: number;
  attacksToday: number;
  attacksThisWeek: number;
  attacksThisMonth: number;
  blockRate: number;
  avgRiskScore: number;
  attacksByType: Record<string, number>;
}

interface RateLimitStats {
  totalUsers: number;
  blockedUsers: number;
  blockedIPs: number;
  avgRequestsPerUser: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ security: SecurityStats; rateLimit: RateLimitStats } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include',
      });

      if (response.status === 401) {
        router.push('/admin/login');
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch stats');

      const data = await response.json();
      setStats(data);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
          <p className="mt-4 text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="bg-red-900/20 border-2 border-red-500/30 rounded-lg p-6 max-w-md backdrop-blur-md">
          <h2 className="text-red-400 font-bold mb-2">Error Loading Dashboard</h2>
          <p className="text-red-300">{error || 'Failed to load stats'}</p>
          <button
            onClick={() => router.push('/admin/login')}
            className="mt-4 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-lg"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  const topAttackTypes = Object.entries(stats.security.attacksByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
                <span className="text-xl">🛡️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">DevShield AI</h1>
                <p className="text-sm text-slate-400 font-medium">Admin Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/admin/attacks"
                className="text-sm font-medium text-slate-300 hover:text-blue-400 transition-colors"
              >
                View Attacks
              </a>
              <a
                href="/admin/users"
                className="text-sm font-medium text-slate-300 hover:text-blue-400 transition-colors"
              >
                Blocked Users
              </a>
              <a
                href="/"
                className="text-sm font-medium text-slate-300 hover:text-blue-400 transition-colors"
              >
                Back to App
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            icon="🚨"
            label="Total Attacks"
            value={stats.security.totalAttacks}
            subtext={`${stats.security.attacksToday} today`}
            color="red"
          />
          <MetricCard
            icon="🛡️"
            label="Attacks Blocked"
            value={stats.security.attacksBlocked}
            subtext={`${stats.security.blockRate}% block rate`}
            color="green"
          />
          <MetricCard
            icon="⚠️"
            label="Avg Risk Score"
            value={Math.round(stats.security.avgRiskScore)}
            subtext="out of 100"
            color="orange"
          />
          <MetricCard
            icon="👥"
            label="Active Users"
            value={stats.rateLimit.totalUsers}
            subtext={`${stats.rateLimit.blockedUsers} blocked`}
            color="blue"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Attack Types */}
          <div className="bg-slate-800/50 rounded-lg shadow-md border border-slate-700/50 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Top Attack Types</h2>
            <div className="space-y-3">
              {topAttackTypes.length > 0 ? (
                topAttackTypes.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-300">{type}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-700 rounded-full w-32">
                        <div
                          className="h-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
                          style={{
                            width: `${Math.min(100, (count / stats.security.totalAttacks) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-bold text-slate-100 w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 text-center py-4">No attacks detected yet</p>
              )}
            </div>
          </div>

          {/* Rate Limiting Stats */}
          <div className="bg-slate-800/50 rounded-lg shadow-md border border-slate-700/50 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-slate-100 mb-4">Rate Limiting</h2>
            <div className="space-y-4">
              <StatRow label="Total Users" value={stats.rateLimit.totalUsers} />
              <StatRow label="Blocked Users" value={stats.rateLimit.blockedUsers} color="red" />
              <StatRow label="Blocked IPs" value={stats.rateLimit.blockedIPs} color="orange" />
              <StatRow
                label="Avg Requests/User"
                value={Math.round(stats.rateLimit.avgRequestsPerUser * 10) / 10}
              />
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-lg shadow-md border border-red-500/30 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📊</span>
              <h3 className="font-bold text-slate-100">This Week</h3>
            </div>
            <p className="text-3xl font-bold text-red-400">{stats.security.attacksThisWeek}</p>
            <p className="text-sm text-slate-400 mt-1">attacks detected</p>
          </div>

          <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 rounded-lg shadow-md border border-blue-500/30 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📅</span>
              <h3 className="font-bold text-slate-100">This Month</h3>
            </div>
            <p className="text-3xl font-bold text-blue-400">{stats.security.attacksThisMonth}</p>
            <p className="text-sm text-slate-400 mt-1">total attacks</p>
          </div>

          <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-lg shadow-md border border-green-500/30 p-6 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🎯</span>
              <h3 className="font-bold text-slate-100">Protection Rate</h3>
            </div>
            <p className="text-3xl font-bold text-green-400">{stats.security.blockRate}%</p>
            <p className="text-sm text-slate-400 mt-1">threats blocked</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-slate-800/50 rounded-lg shadow-md border border-slate-700/50 p-6 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-slate-100 mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="/admin/attacks"
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg"
            >
              View All Attacks
            </a>
            <a
              href="/admin/users"
              className="px-4 py-2 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-lg font-medium hover:from-orange-700 hover:to-orange-800 transition-all shadow-lg"
            >
              Manage Blocked Users
            </a>
            <a
              href="https://us5.datadoghq.com/dashboard/wvp-vci-2rz"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 transition-all shadow-lg"
            >
              Open Datadog Dashboard
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  subtext: string;
  color: 'red' | 'green' | 'orange' | 'blue';
}) {
  const colorClasses = {
    red: 'from-red-900/40 to-orange-900/40 border-red-500/30',
    green: 'from-green-900/40 to-emerald-900/40 border-green-500/30',
    orange: 'from-orange-900/40 to-yellow-900/40 border-orange-500/30',
    blue: 'from-blue-900/40 to-purple-900/40 border-blue-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-lg shadow-md border p-6 backdrop-blur-sm`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-3xl">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-300">{label}</h3>
      </div>
      <p className="text-3xl font-bold text-slate-100">{value}</p>
      <p className="text-sm text-slate-400 mt-1">{subtext}</p>
    </div>
  );
}

function StatRow({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: 'red' | 'orange';
}) {
  const textColor = color === 'red' ? 'text-red-400' : color === 'orange' ? 'text-orange-400' : 'text-slate-100';

  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/30 last:border-0">
      <span className="text-sm font-medium text-slate-400">{label}</span>
      <span className={`text-lg font-bold ${textColor}`}>{value}</span>
    </div>
  );
}
