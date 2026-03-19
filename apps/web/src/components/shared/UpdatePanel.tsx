import type { CSSProperties } from 'react';

import { useAppUpdater } from '../../hooks/useAppUpdater';

export function UpdatePanel() {
  const { status, checking, installing, refresh, install } = useAppUpdater();

  return (
    <section
      style={{
        width: '100%',
        padding: '16px',
        borderRadius: 'var(--mb-radius-md)',
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(241,244,247,0.9))',
        boxShadow: 'var(--mb-shadow-md)',
        color: 'var(--mb-text)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: '10px',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--mb-accent)',
            }}
          >
            Stage 7
          </div>
          <h2
            style={{
              fontSize: '18px',
              marginTop: '4px',
              color: 'var(--mb-text)',
            }}
          >
            Desktop Updates
          </h2>
        </div>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: '999px',
            backgroundColor: status.updateAvailable
              ? 'var(--mb-brand-tint)'
              : 'var(--mb-accent-light)',
            color: status.updateAvailable ? 'var(--mb-brand)' : 'var(--mb-accent)',
            fontSize: '12px',
            fontWeight: 700,
          }}
        >
          {status.updateAvailable ? 'Update Ready' : 'Shipping Prep'}
        </div>
      </div>

      <p
        style={{
          fontSize: '13px',
          color: 'var(--mb-text-secondary)',
          marginBottom: '14px',
        }}
      >
        Signed updater checks can be wired in parallel with the rest of the
        Windows app work. This panel talks to the native Tauri shell, not the
        browser.
      </p>

      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '10px 16px',
          marginBottom: '14px',
        }}
      >
        <div>
          <dt style={labelStyle}>Current version</dt>
          <dd style={valueStyle}>{status.currentVersion}</dd>
        </div>
        <div>
          <dt style={labelStyle}>Updater configured</dt>
          <dd style={valueStyle}>{status.configured ? 'Yes' : 'Not yet'}</dd>
        </div>
        <div>
          <dt style={labelStyle}>Latest release</dt>
          <dd style={valueStyle}>{status.latestVersion ?? 'No update found'}</dd>
        </div>
      </dl>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => refresh(true)}
          disabled={checking}
          style={primaryButtonStyle}
        >
          {checking ? 'Checking...' : 'Check for updates'}
        </button>
        <button
          type="button"
          onClick={install}
          disabled={!status.updateAvailable || installing}
          style={secondaryButtonStyle}
        >
          {installing ? 'Installing...' : 'Install update'}
        </button>
      </div>

      {!status.configured && (
        <p
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: 'var(--mb-text-secondary)',
          }}
        >
          Build with `MUDBRICK_UPDATER_ENDPOINT` and `MUDBRICK_UPDATER_PUBKEY`
          to enable signed update checks against GitHub Releases or another
          update feed.
        </p>
      )}
    </section>
  );
}

const labelStyle: CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--mb-text-secondary)',
};

const valueStyle: CSSProperties = {
  marginTop: '2px',
  fontSize: '15px',
  fontWeight: 600,
  color: 'var(--mb-text)',
};

const primaryButtonStyle: CSSProperties = {
  padding: '10px 14px',
  border: 'none',
  borderRadius: 'var(--mb-radius-sm)',
  backgroundColor: 'var(--mb-brand)',
  color: '#fff',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '10px 14px',
  borderRadius: 'var(--mb-radius-sm)',
  border: '1px solid var(--mb-border)',
  backgroundColor: 'var(--mb-surface)',
  color: 'var(--mb-text)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
};
