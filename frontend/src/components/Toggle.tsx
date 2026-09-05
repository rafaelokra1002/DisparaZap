'use client';

interface ToggleProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export default function Toggle({ enabled, onChange, label }: ToggleProps) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-emerald-500' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
      <span className="text-sm text-gray-700 font-medium">{label}</span>
    </label>
  );
}
