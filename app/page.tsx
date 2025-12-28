import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-md shadow-xl">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-2xl shadow-lg shadow-purple-500/20">
                🛡️
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  DevShield AI
                </h1>
                <p className="text-sm text-slate-400 font-medium">Real-time LLM Security Monitoring</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-900/40 to-green-900/40 border border-emerald-500/30 px-5 py-2.5 shadow-lg shadow-emerald-500/10">
              <div className="relative">
                <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50"></div>
                <div className="absolute inset-0 h-3 w-3 rounded-full bg-emerald-300 animate-ping"></div>
              </div>
              <span className="text-sm font-semibold text-emerald-300">System Protected</span>
            </div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <ChatInterface />
      </main>
      
      <footer className="border-t border-slate-700/50 bg-slate-900/80 backdrop-blur-sm py-4">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-slate-400">
            Powered by <span className="font-semibold text-slate-300">Google Cloud AI</span> • 
            <span className="font-semibold text-slate-300"> Datadog APM</span> • 
            <span className="font-semibold text-slate-300"> Vertex AI</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
