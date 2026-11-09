import { ListSkeleton } from '@/components/ui/skeleton';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { pollsApi, type PollInfo, type PollQuestion } from '../api/polls';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { CheckIcon, CloseIcon } from '@/components/icons';
import { PiClipboardTextDuotone, PiWarningCircleDuotone } from 'react-icons/pi';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Chip, EmptyState, Page, Surface } from '@/components/spofy/ui';
import { PageSkeleton, Skeleton } from '@/components/ui/skeleton';

export default function Polls() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedPoll, setSelectedPoll] = useState<PollInfo | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<PollQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [completionMessage, setCompletionMessage] = useState<{
    reward: number | null;
    message: string;
  } | null>(null);

  const {
    data: polls,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['polls'],
    queryFn: pollsApi.getPolls,
  });

  const startPollMutation = useMutation({
    mutationFn: pollsApi.startPoll,
    onSuccess: (data) => {
      setCurrentQuestion(data.question);
      setQuestionIndex(data.current_question_index);
      setTotalQuestions(data.total_questions);
      setCompletionMessage(null);
    },
  });

  const answerMutation = useMutation({
    mutationFn: ({
      responseId,
      questionId,
      optionId,
    }: {
      responseId: number;
      questionId: number;
      optionId: number;
    }) => pollsApi.answerQuestion(responseId, questionId, optionId),
    onSuccess: (data) => {
      if (data.is_completed) {
        setCurrentQuestion(null);
        setCompletionMessage({
          reward: data.reward_granted,
          message: data.message || t('polls.completed'),
        });
        queryClient.invalidateQueries({ queryKey: ['polls'] });
      } else if (data.next_question) {
        setCurrentQuestion(data.next_question);
        setQuestionIndex(data.current_question_index || 0);
        setTotalQuestions(data.total_questions);
      }
    },
  });

  const handleStartPoll = (poll: PollInfo) => {
    setSelectedPoll(poll);
    startPollMutation.mutate(poll.response_id);
  };

  const handleAnswer = (optionId: number) => {
    if (selectedPoll && currentQuestion) {
      answerMutation.mutate({
        responseId: selectedPoll.response_id,
        questionId: currentQuestion.id,
        optionId,
      });
    }
  };

  const handleClosePoll = () => {
    setSelectedPoll(null);
    setCurrentQuestion(null);
    setCompletionMessage(null);
  };

  const pollDialogRef = useFocusTrap<HTMLDivElement>(!!selectedPoll, {
    onEscape: handleClosePoll,
  });

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
        <PageHeader title={t('polls.title')} backTo="/" />
        <EmptyState icon={<PiWarningCircleDuotone />} title={t('polls.error')} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title={t('polls.title')} backTo="/" />

      {/* Poll Modal */}
      {selectedPoll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Окно поверх списка — сплошное, подложка размыта: сквозь
              полупрозрачную карточку текст страницы ложился на текст вопроса. */}
          <div
            className="absolute inset-0 bg-dark-950/80"
            onClick={handleClosePoll}
            aria-hidden="true"
          />
          <div
            ref={pollDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="poll-dialog-title"
            tabIndex={-1}
            className="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-dark-900 p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="poll-dialog-title" className="text-lg font-bold text-dark-50">
                {selectedPoll.title}
              </h2>
              <button
                onClick={handleClosePoll}
                aria-label={t('common.close')}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {startPollMutation.isPending && (
              <div className="flex justify-center py-8">
                <ListSkeleton />
              </div>
            )}

            {completionMessage && (
              <div className="space-y-4">
                <div className="flex flex-col items-center rounded-2xl bg-success-500/10 p-4 text-center text-success-400">
                  <CheckIcon className="h-5 w-5" />
                  <p className="mt-2 font-medium">{completionMessage.message}</p>
                  {completionMessage.reward && (
                    <p className="mt-1 text-sm">
                      +{completionMessage.reward} {t('polls.reward')}
                    </p>
                  )}
                </div>
                <Button tone="secondary" onClick={handleClosePoll} className="w-full">
                  {t('common.close')}
                </Button>
              </div>
            )}

            {currentQuestion && !completionMessage && (
              <div className="space-y-4">
                <div className="text-[13px] text-dark-400">
                  {t('polls.question')} {questionIndex + 1} {t('polls.of')} {totalQuestions}
                </div>
                <div className="h-2 w-full rounded-full bg-dark-800">
                  <div
                    className="h-2 rounded-full bg-accent-500 transition-all"
                    style={{ width: `${((questionIndex + 1) / totalQuestions) * 100}%` }}
                  />
                </div>

                <p className="text-[17px] font-semibold text-dark-50">{currentQuestion.text}</p>

                <div className="space-y-2">
                  {currentQuestion.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => handleAnswer(option.id)}
                      disabled={answerMutation.isPending}
                      className="min-h-12 w-full rounded-2xl bg-dark-800/70 px-4 py-3 text-left text-[15px] text-dark-100 transition-colors hover:bg-dark-700/70 disabled:opacity-50"
                    >
                      {option.text}
                    </button>
                  ))}
                </div>

                {answerMutation.isPending && (
                  <div className="flex justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Polls List */}
      {polls && polls.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {polls.map((poll) => (
            <Surface key={poll.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-[15px] font-semibold text-dark-100">
                    {poll.title}
                  </h3>
                  {poll.description && (
                    <p className="mt-1 text-[13px] leading-snug text-dark-400 [overflow-wrap:anywhere]">
                      {poll.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-4 text-[13px] text-dark-400">
                    <span>
                      {poll.answered_questions}/
                      {t('polls.questions', { count: poll.total_questions })}
                    </span>
                  </div>
                </div>
                {poll.reward_amount && (
                  <span className="shrink-0">
                    <Chip tone="success">+{poll.reward_amount}</Chip>
                  </span>
                )}
              </div>

              <div className="mt-4">
                {poll.is_completed ? (
                  <Button tone="secondary" disabled className="w-full opacity-60">
                    <CheckIcon className="h-5 w-5" />
                    {t('polls.completed')}
                  </Button>
                ) : (
                  <Button onClick={() => handleStartPoll(poll)} className="w-full">
                    {poll.answered_questions > 0 ? t('polls.continue') : t('polls.start')}
                  </Button>
                )}
              </div>
            </Surface>
          ))}
        </div>
      ) : (
        <EmptyState icon={<PiClipboardTextDuotone />} title={t('polls.noPolls')} />
      )}
    </Page>
  );
}
