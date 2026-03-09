export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-text">Privacy Policy</h1>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-text-muted">
        <p>
          <strong className="text-text">Last updated:</strong> March 2026
        </p>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">1. Information We Collect</h2>
          <p>
            We collect information you provide when creating an account, including your
            username, email address, and usage data to improve our services.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">2. How We Use Your Information</h2>
          <p>
            Your information is used to provide and improve the AuroraCraft platform,
            authenticate your identity, and communicate important updates.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">3. Data Security</h2>
          <p>
            We implement industry-standard security measures to protect your data.
            All passwords are hashed and sessions are managed via secure HTTP-only cookies.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">4. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active.
            You may request deletion of your account and associated data at any time.
          </p>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-text">5. Contact</h2>
          <p>
            For privacy-related inquiries, please contact us at privacy@auroracraft.dev.
          </p>
        </section>
      </div>
    </div>
  )
}
