import { notFound } from 'next/navigation';
import { getTeam } from '@/lib/teams';
import { ChatInterface } from '@/components/chat-interface';

interface PageProps {
  params: Promise<{ teamId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { teamId } = await params;
  const team = getTeam(teamId);

  if (!team) {
    notFound();
  }

  return <ChatInterface team={team} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  return {
    title: team ? `${team.name} AI 어시스턴트` : '페이지 없음',
  };
}
