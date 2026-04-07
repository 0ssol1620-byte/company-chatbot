import Link from 'next/link';
import { teams } from '@/lib/teams';

const colorClasses: Record<string, { card: string; badge: string; btn: string }> = {
  blue:   { card: 'hover:border-blue-400 hover:shadow-blue-100',   badge: 'bg-blue-50 text-blue-700',   btn: 'bg-blue-600 hover:bg-blue-700' },
  green:  { card: 'hover:border-green-400 hover:shadow-green-100', badge: 'bg-green-50 text-green-700', btn: 'bg-green-600 hover:bg-green-700' },
  orange: { card: 'hover:border-orange-400 hover:shadow-orange-100', badge: 'bg-orange-50 text-orange-700', btn: 'bg-orange-500 hover:bg-orange-600' },
  purple: { card: 'hover:border-purple-400 hover:shadow-purple-100', badge: 'bg-purple-50 text-purple-700', btn: 'bg-purple-600 hover:bg-purple-700' },
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">사내 AI 어시스턴트</h1>
          <p className="text-gray-500 text-lg">팀을 선택하면 해당 팀 전용 AI 어시스턴트로 연결됩니다.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {teams.map((team) => {
            const cls = colorClasses[team.color] ?? colorClasses.purple;
            return (
              <Link
                key={team.id}
                href={`/chat/${team.id}`}
                className={`group bg-white rounded-2xl border-2 border-gray-100 p-6 shadow-sm transition-all duration-200 hover:shadow-lg ${cls.card}`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{team.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-gray-900">{team.name}</h2>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls.badge}`}>
                        {team.model}
                      </span>
                    </div>
                    <p className="text-gray-500 text-sm">{team.description}</p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <span className={`text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors ${cls.btn}`}>
                    시작하기 →
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 mt-12">
          각 팀의 AI 어시스턴트는 팀 전용 지식과 역할에 맞게 설정되어 있습니다.
        </p>
      </div>
    </main>
  );
}
