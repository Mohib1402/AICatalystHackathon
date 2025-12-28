export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const tracer = await import('dd-trace');
    
    tracer.default.init({
      logInjection: true,
      runtimeMetrics: true,
      env: process.env.DD_ENV || 'development',
      service: process.env.DD_SERVICE || 'devshield-ai',
      version: '1.0.0',
    });

    console.log('✅ Datadog APM initialized with dd-trace');
    console.log(`   Service: ${process.env.DD_SERVICE || 'devshield-ai'}`);
    console.log(`   Environment: ${process.env.DD_ENV || 'development'}`);
    console.log(`   Site: ${process.env.DD_SITE || 'us5.datadoghq.com'}`);
  }
}
