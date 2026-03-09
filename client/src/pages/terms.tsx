export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-text">Terms of Service</h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-text-muted">
        <p>
          <strong className="text-text">Last updated:</strong> March 2026
        </p>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">1. Acceptance of Terms</h2>
          <p>
            By accessing and using AuroraCraft, you agree to be bound by these Terms of Service.
            If you do not agree to these terms, please do not use the platform.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">2. Description of Service</h2>
          <p>
            AuroraCraft provides an AI-powered platform for developing Minecraft plugins.
            The service includes code generation, compilation, and project management tools.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the security of your account credentials.
            You must provide accurate information when creating an account.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">4. Intellectual Property</h2>
          <p>
            You retain ownership of all plugins and code you create using AuroraCraft.
            The platform and its underlying technology remain the property of AuroraCraft.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">5. Limitation of Liability</h2>
          <p>
            AuroraCraft is provided "as is" without warranties of any kind.
            We are not liable for any damages arising from the use of the platform.
          </p>
        </section>
      </div>
    </div>
  )
}
