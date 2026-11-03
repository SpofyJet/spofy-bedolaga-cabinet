import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { contestsApi, type ContestInfo, type ContestGameData } from '../api/contests';
import { XIcon } from '@/components/icons';
import { PiGameControllerDuotone, PiWarningCircleDuotone } from 'react-icons/pi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Chip, EmptyState, Page, Surface } from '@/components/spofy/ui';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Contests() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedContest, setSelectedContest] = useState<ContestInfo | null>(null);
  const [gameData, setGameData] = useState<ContestGameData | null>(null);
  const [result, setResult] = useState<{ is_winner: boolean; message: string } | null>(null);

  const {
    data: contests,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['contests'],
    queryFn: contestsApi.getContests,
  });

  const getGameMutation = useMutation({
    mutationFn: contestsApi.getContestGame,
    onSuccess: (data) => {
      setGameData(data);
      setResult(null);
    },
  });

  const submitAnswerMutation = useMutation({
    mutationFn: ({ roundId, answer }: { roundId: number; answer: string }) =>
      contestsApi.submitAnswer(roundId, answer),
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });

  const handlePlayContest = async (contest: ContestInfo) => {
    setSelectedContest(contest);
    getGameMutation.mutate(contest.id);
  };

  const handleSubmitAnswer = (answer: string) => {
    if (gameData) {
      submitAnswerMutation.mutate({ roundId: gameData.round_id, answer });
    }
  };

  const handleCloseGame = () => {
    setSelectedContest(null);
    setGameData(null);
    setResult(null);
  };

  if (isLoading) {
    return (
      <Page>
        <PageSkeleton leading={['h-10 w-10 rounded-2xl']} titleWidth="w-40">
          <Skeleton variant="card" count={3} className="h-32 rounded-3xl" />
        </PageSkeleton>
      </Page>
    );
  }

  if (error) {
    return (
      <Page>
        <PageHeader title={t('contests.title')} backTo="/" />
        <EmptyState icon={<PiWarningCircleDuotone />} title={t('contests.error')} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title={t('contests.title')} backTo="/" />

      {/* Game Modal */}
      {selectedContest && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-dark-950/80 p-4">
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-dark-900 p-5 ring-1 ring-inset ring-dark-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-dark-50">{selectedContest.name}</h2>
              <button
                type="button"
                onClick={handleCloseGame}
                aria-label={t('common.close')}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {getGameMutation.isPending && (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
              </div>
            )}

            {result && (
              <div
                className={`mb-4 rounded-2xl p-4 ring-1 ring-inset ${result.is_winner ? 'bg-success-500/10 text-success-400 ring-success-500/25' : 'bg-error-500/10 text-error-400 ring-error-500/25'}`}
              >
                <p className="font-medium">{result.message}</p>
              </div>
            )}

            {gameData && !result && (
              <div className="space-y-4">
                <p className="text-dark-300">{gameData.instructions}</p>

                {/* Render game based on type */}
                {(gameData.game_type === 'quest' || gameData.game_type === 'locks') && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {Array.from({
                      length: gameData.game_data.total || gameData.game_data.grid_size || 9,
                    }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmitAnswer(String(i))}
                        disabled={submitAnswerMutation.isPending}
                        className="flex aspect-square items-center justify-center rounded-2xl bg-dark-800 text-2xl transition-colors hover:bg-dark-700"
                      >
                        {gameData.game_type === 'locks' ? '🔒' : '🎛'}
                      </button>
                    ))}
                  </div>
                )}

                {gameData.game_type === 'server' && (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {gameData.game_data.flags?.map((flag: string, i: number) => (
                      <button
                        key={i}
                        onClick={() => handleSubmitAnswer(flag)}
                        disabled={submitAnswerMutation.isPending}
                        className="rounded-2xl bg-dark-800 p-3 text-2xl transition-colors hover:bg-dark-700"
                      >
                        {flag}
                      </button>
                    ))}
                  </div>
                )}

                {gameData.game_type === 'blitz' && (
                  <button
                    onClick={() => handleSubmitAnswer('blitz')}
                    disabled={submitAnswerMutation.isPending}
                    className="h-14 w-full rounded-2xl bg-accent-500 text-[17px] font-bold text-on-accent transition-colors hover:bg-accent-600"
                  >
                    {gameData.game_data.button_text || t('contests.imHere')}
                  </button>
                )}

                {['cipher', 'emoji', 'anagram'].includes(gameData.game_type) && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem(
                        'answer',
                      ) as HTMLInputElement;
                      handleSubmitAnswer(input.value);
                    }}
                    className="space-y-3"
                  >
                    <div className="rounded-2xl bg-dark-800 p-4 text-center text-2xl font-semibold tracking-wide text-dark-50">
                      {gameData.game_data.question || gameData.game_data.letters}
                    </div>
                    <input
                      name="answer"
                      type="text"
                      placeholder={t('contests.enterAnswer')}
                      className="input"
                    />
                    <Button
                      type="submit"
                      disabled={submitAnswerMutation.isPending}
                      className="w-full"
                    >
                      {t('contests.submit')}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {result && (
              <Button tone="secondary" onClick={handleCloseGame} className="mt-4 w-full">
                {t('common.close')}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Contests List */}
      {contests && contests.length > 0 ? (
        // grid-cols-1 = minmax(0,1fr): без него колонка росла по самой длинной
        // ссылке в описании, и вся страница листалась вбок.
        <div className="grid grid-cols-1 gap-3">
          {contests.map((contest) => (
            <Surface key={contest.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="break-words text-[15px] font-semibold text-dark-100">
                    {contest.name}
                  </h3>
                  {contest.description && (
                    <p className="mt-1 text-[13px] leading-snug text-dark-400 [overflow-wrap:anywhere]">
                      {contest.description}
                    </p>
                  )}
                </div>
                <span className="shrink-0">
                  <Chip tone="success">+{t('contests.days', { count: contest.prize_days })}</Chip>
                </span>
              </div>

              <div className="mt-4">
                {contest.already_played ? (
                  <Button tone="secondary" disabled className="w-full opacity-60">
                    {t('contests.alreadyPlayed')}
                  </Button>
                ) : (
                  <Button onClick={() => handlePlayContest(contest)} className="w-full">
                    {t('contests.play')}
                  </Button>
                )}
              </div>
            </Surface>
          ))}
        </div>
      ) : (
        <EmptyState icon={<PiGameControllerDuotone />} title={t('contests.noContests')} />
      )}
    </Page>
  );
}
