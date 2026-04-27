import { Trophy } from 'lucide-react';
import { getTeamAvatarPalette, getWorldCupTeam } from '../../utils/worldCupTeams';

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default function TeamAvatar({ teamCode, name = 'Usuario', size = 64, className = '' }) {
  const team = getWorldCupTeam(teamCode);
  const palette = getTeamAvatarPalette(teamCode);
  const isColombia = teamCode === 'co';
  const isCroatia = teamCode === 'hr';
  const isParaguay = teamCode === 'py';
  const isNorway = teamCode === 'no';
  const isTurkey = teamCode === 'tr';
  const isArgentina = teamCode === 'ar';
  const isSouthAfrica = teamCode === 'za';
  const isCuracao = teamCode === 'cw';
  const isAustralia = teamCode === 'au';
  const isSwitzerland = teamCode === 'ch';
  const isSweden = teamCode === 'se';
  const isJapan = teamCode === 'jp';
  const isKorea = teamCode === 'kr';
  const isEngland = teamCode === 'gb-eng';
  const isMexico = teamCode === 'mx';
  const showDefaultBall = !team;

  const jerseyBackground = isColombia
    ? `linear-gradient(180deg, ${palette.primary} 0%, ${palette.primary} 82%, ${hexToRgba('#e0a800', 0.95)} 100%)`
    : isCroatia
      ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
      : isAustralia
        ? 'linear-gradient(180deg, #facc15 0%, #eab308 100%)'
        : isSwitzerland
          ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
          : isSweden
            ? 'linear-gradient(180deg, #facc15 0%, #eab308 100%)'
            : isJapan
              ? 'linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 100%)'
              : isKorea
                ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
                : isEngland
                  ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
                  : isMexico
                    ? 'linear-gradient(180deg, #15803d 0%, #166534 100%)'
      : isSouthAfrica
        ? 'linear-gradient(180deg, #facc15 0%, #eab308 100%)'
      : isParaguay
        ? 'linear-gradient(90deg, #dc2626 0%, #dc2626 20%, #ffffff 20%, #ffffff 40%, #dc2626 40%, #dc2626 60%, #ffffff 60%, #ffffff 80%, #dc2626 80%, #dc2626 100%)'
        : isNorway
          ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
          : isCuracao
            ? 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)'
          : isTurkey
            ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
            : isArgentina
              ? 'linear-gradient(90deg, #7dd3fc 0%, #7dd3fc 22%, #ffffff 22%, #ffffff 39%, #7dd3fc 39%, #7dd3fc 61%, #ffffff 61%, #ffffff 78%, #7dd3fc 78%, #7dd3fc 100%)'
    : `linear-gradient(135deg, ${palette.primary} 0%, ${palette.primary} 48%, ${palette.secondary} 48%, ${palette.secondary} 100%)`;
  const centerStripeBackground = isColombia
    ? `linear-gradient(180deg, ${palette.secondary} 0%, ${palette.secondary} 58%, ${palette.accent} 58%, ${palette.accent} 100%)`
    : isTurkey
      ? 'transparent'
      : isNorway
        ? 'linear-gradient(180deg, #ffffff 0%, #ffffff 28%, #1e3a8a 28%, #1e3a8a 72%, #ffffff 72%, #ffffff 100%)'
        : isArgentina
          ? 'linear-gradient(180deg, rgba(250, 204, 21, 0.95) 0%, rgba(250, 204, 21, 0.65) 100%)'
    : hexToRgba(palette.accent, 0.85);
  const leftSleeveBackground = isColombia
    ? `linear-gradient(180deg, ${hexToRgba(palette.primary, 0.96)} 0%, ${palette.secondary} 100%)`
    : isCroatia
      ? 'linear-gradient(180deg, #ffffff 0%, #fee2e2 100%)'
      : isAustralia
        ? 'linear-gradient(180deg, #15803d 0%, #166534 100%)'
        : isSwitzerland
          ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
          : isSweden
            ? 'linear-gradient(180deg, #facc15 0%, #eab308 100%)'
            : isJapan
              ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
              : isKorea
                ? 'linear-gradient(180deg, #2563eb 0%, #1e3a8a 100%)'
                : isEngland
                  ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
                  : isMexico
                    ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
      : isSouthAfrica
        ? 'linear-gradient(180deg, #facc15 0%, #15803d 100%)'
      : isParaguay
        ? 'linear-gradient(180deg, #dc2626 0%, #ffffff 100%)'
        : isNorway
          ? 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)'
          : isCuracao
            ? 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)'
          : isTurkey
            ? 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)'
            : isArgentina
              ? 'linear-gradient(180deg, #7dd3fc 0%, #ffffff 100%)'
    : `linear-gradient(180deg, ${palette.secondary} 0%, ${palette.primary} 100%)`;
  const rightSleeveBackground = isColombia
    ? `linear-gradient(180deg, ${hexToRgba(palette.primary, 0.96)} 0%, ${palette.accent} 100%)`
    : isCroatia
      ? 'linear-gradient(180deg, #ffffff 0%, #dc2626 100%)'
      : isAustralia
        ? 'linear-gradient(180deg, #15803d 0%, #166534 100%)'
        : isSwitzerland
          ? 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)'
          : isSweden
            ? 'linear-gradient(180deg, #facc15 0%, #eab308 100%)'
            : isJapan
              ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
              : isKorea
                ? 'linear-gradient(180deg, #2563eb 0%, #1e3a8a 100%)'
                : isEngland
                  ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
                  : isMexico
                    ? 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)'
      : isSouthAfrica
        ? 'linear-gradient(180deg, #facc15 0%, #dc2626 100%)'
      : isParaguay
        ? 'linear-gradient(180deg, #ffffff 0%, #dc2626 100%)'
        : isNorway
          ? 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)'
          : isCuracao
            ? 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)'
          : isTurkey
            ? 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)'
            : isArgentina
              ? 'linear-gradient(180deg, #ffffff 0%, #7dd3fc 100%)'
    : `linear-gradient(180deg, ${palette.primary} 0%, ${palette.accent} 100%)`;

  return (
    <div
      className={`relative inline-flex shrink-0 overflow-hidden rounded-full border-2 border-white/85 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at top, ${hexToRgba(palette.accent, 0.25)} 0%, ${hexToRgba(palette.primary, 0.18)} 40%, #eff6ff 100%)`,
        boxShadow: `0 8px 18px ${hexToRgba(palette.primary, 0.18)}, inset 0 0 0 1px ${hexToRgba('#ffffff', 0.35)}`,
      }}
      aria-label={showDefaultBall ? `Avatar por defecto de ${name}` : `Avatar de ${name} con camiseta de ${team.name}`}
      title={showDefaultBall ? `${name} · Avatar por defecto` : `${name} · ${team.name}`}
    >
      {showDefaultBall ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="flex items-center justify-center rounded-full border border-white/70 bg-white/90"
            style={{
              width: '68%',
              height: '68%',
              boxShadow: `0 10px 18px ${hexToRgba('#0f172a', 0.14)}, inset 0 -6px 12px ${hexToRgba('#cbd5e1', 0.35)}`,
            }}
          >
            <Trophy
              style={{ width: '42%', height: '42%' }}
              className="text-amber-500"
              strokeWidth={2.2}
            />
          </div>
        </div>
      ) : (
        <>
      <div
        className="absolute left-1/2 top-[14%] -translate-x-1/2 rounded-full"
        style={{
          width: '32%',
          height: '32%',
          background: 'linear-gradient(180deg, #f6d6b8 0%, #eab38d 100%)',
          boxShadow: 'inset 0 -3px 0 rgba(0, 0, 0, 0.06), 0 1px 0 rgba(255, 255, 255, 0.45)',
        }}
      />
      <div
        className="absolute top-[24%] left-[36%] rounded-full bg-gray-900"
        style={{ width: '4.5%', height: '4.5%' }}
      />
      <div
        className="absolute top-[24%] right-[36%] rounded-full bg-gray-900"
        style={{ width: '4.5%', height: '4.5%' }}
      />
      <div
        className="absolute left-1/2 top-[29%] -translate-x-1/2 rounded-full"
        style={{
          width: '4%',
          height: '8%',
          borderLeft: '1px solid rgba(120, 72, 41, 0.35)',
        }}
      />
      <div
        className="absolute left-1/2 top-[33%] -translate-x-1/2 rounded-b-full"
        style={{
          width: '12%',
          height: '5%',
          borderBottom: '2px solid rgba(120, 44, 22, 0.45)',
        }}
      />
      <div
        className="absolute top-[23%] left-[30.5%] rounded-full"
        style={{
          width: '4%',
          height: '8%',
          background: 'linear-gradient(180deg, #eab38d 0%, #d89a74 100%)',
        }}
      />
      <div
        className="absolute top-[23%] right-[30.5%] rounded-full"
        style={{
          width: '4%',
          height: '8%',
          background: 'linear-gradient(180deg, #eab38d 0%, #d89a74 100%)',
        }}
      />
      <div
        className="absolute left-1/2 top-[10%] -translate-x-1/2 rounded-full"
        style={{
          width: '37%',
          height: '18%',
          background: 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
        }}
      />
      <div
        className="absolute left-1/2 top-[12%] -translate-x-1/2"
        style={{
          width: '24%',
          height: '10%',
          borderTopLeftRadius: '9999px',
          borderTopRightRadius: '9999px',
          borderBottomLeftRadius: '45%',
          borderBottomRightRadius: '45%',
          background: 'linear-gradient(180deg, #111827 0%, #1f2937 100%)',
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 overflow-hidden rounded-t-[42%]"
        style={{
          width: '82%',
          height: '58%',
          background: jerseyBackground,
          boxShadow: `inset 0 10px 18px ${hexToRgba('#000000', 0.1)}`,
        }}
      >
        <div
          className="absolute left-1/2 top-[8%] -translate-x-1/2 rounded-b-full"
          style={{
            width: '26%',
            height: '18%',
            background: '#f8fafc',
          }}
        />
        <div
          className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full"
          style={{
            width: '16%',
            height: '42%',
            background: centerStripeBackground,
          }}
        />
        {isCroatia && (
          <div
            className="absolute inset-x-[16%] top-[14%] bottom-[8%]"
            style={{
              background: 'linear-gradient(90deg, #dc2626 0%, #dc2626 25%, #ffffff 25%, #ffffff 50%, #dc2626 50%, #dc2626 75%, #ffffff 75%, #ffffff 100%), linear-gradient(0deg, transparent 0%, transparent 25%, rgba(220, 38, 38, 0.96) 25%, rgba(220, 38, 38, 0.96) 50%, transparent 50%, transparent 75%, rgba(220, 38, 38, 0.96) 75%, rgba(220, 38, 38, 0.96) 100%)',
              backgroundSize: '34% 26%, 34% 26%',
              clipPath: 'polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%)',
              backgroundPosition: '0 0, 17% 13%',
              opacity: 0.98,
            }}
          />
        )}
        {isSouthAfrica && (
          <>
            <div
              className="absolute left-0 right-0 top-[18%]"
              style={{ height: '7%', background: '#15803d' }}
            />
            <div
              className="absolute left-0 right-0 top-[25%]"
              style={{ height: '3%', background: '#dc2626' }}
            />
          </>
        )}
        {isNorway && (
          <>
            <div
              className="absolute left-0 right-0 top-[30%]"
              style={{ height: '10%', background: '#ffffff' }}
            />
            <div
              className="absolute left-0 right-0 top-[33%]"
              style={{ height: '4%', background: '#1e3a8a' }}
            />
          </>
        )}
        {isCuracao && (
          <div
            className="absolute left-0 right-0 top-[30%]"
            style={{ height: '8%', background: '#facc15' }}
          />
        )}
        {isTurkey && (
          <div
            className="absolute left-[28%] top-[24%] rounded-full border-2 border-red-600"
            style={{ width: '16%', height: '16%' }}
          >
            <div
              className="absolute left-[42%] top-[12%] rounded-full bg-white"
              style={{ width: '70%', height: '70%' }}
            />
            <div
              className="absolute right-[-55%] top-[26%] bg-red-600"
              style={{
                width: '28%',
                height: '28%',
                clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
              }}
            />
          </div>
        )}
        <div
          className="absolute left-0 top-[10%] rounded-r-full"
          style={{
            width: '24%',
            height: '34%',
            background: leftSleeveBackground,
          }}
        />
        <div
          className="absolute right-0 top-[10%] rounded-l-full"
          style={{
            width: '24%',
            height: '34%',
            background: rightSleeveBackground,
          }}
        />
        {isColombia && (
          <>
            <div
              className="absolute left-0 right-0 top-[8%]"
              style={{
                height: '7%',
                background: palette.secondary,
              }}
            />
            <div
              className="absolute left-0 right-0 top-[15%]"
              style={{
                height: '5%',
                background: palette.accent,
              }}
            />
          </>
        )}
        {team?.flag && (
          <div
            className="absolute right-[14%] top-[20%] flex items-center justify-center overflow-hidden rounded-full border border-white/80 bg-white"
            style={{
              width: '22%',
              height: '22%',
              boxShadow: `0 2px 6px ${hexToRgba('#000000', 0.18)}`,
            }}
          >
            <img src={team.flag} alt={team.name} className="h-full w-full object-cover" />
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}