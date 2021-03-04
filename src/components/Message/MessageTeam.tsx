import React, { useMemo, useRef } from 'react';
import type { TFunction } from 'i18next';

import { MessageRepliesCountButton } from './MessageRepliesCountButton';
import { MessageTimestamp } from './MessageTimestamp';
import {
  useActionHandler,
  useEditHandler,
  useMentionsUIHandler,
  useOpenThreadHandler,
  useReactionClick,
  useReactionHandler,
  useRetryHandler,
  useUserHandler,
  useUserRole,
} from './hooks';
import {
  PinIndicator as DefaultPinIndicator,
  DeliveredCheckIcon,
  ErrorIcon,
  ReactionIcon,
  ThreadIcon,
} from './icons';
import { areMessagePropsEqual, getReadByTooltipText } from './utils';

import { Attachment as DefaultAttachment } from '../Attachment';
import { Avatar as DefaultAvatar } from '../Avatar';
import { LoadingIndicator } from '../Loading';
import { MessageActions } from '../MessageActions';
import {
  EditMessageForm as DefaultEditMessageForm,
  MessageInput,
} from '../MessageInput';
import { MML } from '../MML';
import {
  ReactionSelector as DefaultReactionSelector,
  SimpleReactionsList as DefaultReactionsList,
} from '../Reactions';
import { Tooltip } from '../Tooltip';

import { useChannelContext } from '../../context/ChannelContext';
import { useChatContext } from '../../context/ChatContext';
import { useTranslationContext } from '../../context/TranslationContext';
import { isOnlyEmojis, renderText, smartRender } from '../../utils';

import type { MessageUIComponentProps } from './types';

import type { TranslationLanguages } from 'stream-chat';

import type {
  DefaultAttachmentType,
  DefaultChannelType,
  DefaultCommandType,
  DefaultEventType,
  DefaultMessageType,
  DefaultReactionType,
  DefaultUserType,
  UnknownType,
} from '../../../types/types';

export type MessageTeamProps<
  At extends UnknownType = DefaultAttachmentType,
  Ch extends UnknownType = DefaultChannelType,
  Co extends string = DefaultCommandType,
  Ev extends UnknownType = DefaultEventType,
  Me extends UnknownType = DefaultMessageType,
  Re extends UnknownType = DefaultReactionType,
  Us extends DefaultUserType = DefaultUserType
> = MessageUIComponentProps<At, Ch, Co, Ev, Me, Re, Us> & {
  t: TFunction;
};

/**
 * MessageTeam - Render component, should be used together with the Message component
 * Implements the look and feel for a team style collaboration environment
 *
 * @example ./MessageTeam.md
 */
const UnMemoizedMessageTeam = <
  At extends UnknownType = DefaultAttachmentType,
  Ch extends UnknownType = DefaultChannelType,
  Co extends string = DefaultCommandType,
  Ev extends UnknownType = DefaultEventType,
  Me extends UnknownType = DefaultMessageType,
  Re extends UnknownType = DefaultReactionType,
  Us extends DefaultUserType<Us> = DefaultUserType
>(
  props: MessageTeamProps<At, Ch, Co, Ev, Me, Re, Us>,
) => {
  const {
    Avatar = DefaultAvatar,
    channelConfig: propChannelConfig,
    clearEditingState: propClearEdit,
    editing: propEditing,
    EditMessageInput = DefaultEditMessageForm,
    formatDate,
    getMessageActions,
    groupStyles = ['single'],
    handleAction: propHandleAction,
    handleOpenThread: propHandleOpenThread,
    handleReaction: propHandleReaction,
    handleRetry: propHandleRetry,
    initialMessage,
    message,
    MessageDeleted,
    onMentionsClickMessage: propOnMentionsClick,
    onMentionsHoverMessage: propOnMentionsHover,
    onUserClick: propOnUserClick,
    onUserHover: propOnUserHover,
    PinIndicator = DefaultPinIndicator,
    ReactionsList = DefaultReactionsList,
    ReactionSelector = DefaultReactionSelector,
    setEditingState: propSetEdit,
    t: propT,
    threadList,
    unsafeHTML,
    updateMessage: propUpdateMessage,
  } = props;

  const { channel, updateMessage: channelUpdateMessage } = useChannelContext<
    At,
    Ch,
    Co,
    Ev,
    Me,
    Re,
    Us
  >();
  const { t: contextT, userLanguage } = useTranslationContext();

  const channelConfig = propChannelConfig || channel?.getConfig();
  const t = propT || contextT;

  const reactionSelectorRef = useRef<HTMLDivElement | null>(null);
  const messageWrapperRef = useRef<HTMLDivElement | null>(null);

  const {
    clearEdit: ownClearEditing,
    editing: ownEditing,
    setEdit: ownSetEditing,
  } = useEditHandler();
  const editing = propEditing || ownEditing;

  const setEdit = propSetEdit || ownSetEditing;
  const clearEdit = propClearEdit || ownClearEditing;
  const handleOpenThread = useOpenThreadHandler(message);
  const handleReaction = useReactionHandler(message);
  const handleAction = useActionHandler(message);
  const retryHandler = useRetryHandler<At, Ch, Co, Ev, Me, Re, Us>();
  const retry = propHandleRetry || retryHandler;

  const { onMentionsClick, onMentionsHover } = useMentionsUIHandler(message, {
    onMentionsClick: propOnMentionsClick,
    onMentionsHover: propOnMentionsHover,
  });

  const {
    isReactionEnabled,
    onReactionListClick,
    showDetailedReactions,
  } = useReactionClick(message, reactionSelectorRef, messageWrapperRef);

  const { onUserClick, onUserHover } = useUserHandler(message, {
    onUserClickHandler: propOnUserClick,
    onUserHoverHandler: propOnUserHover,
  });

  const messageTextToRender =
    message?.i18n?.[`${userLanguage}_text` as `${TranslationLanguages}_text`] ||
    message?.text;

  const messageMentionedUsersItem = message?.mentioned_users;

  const messageText = useMemo(
    () => renderText(messageTextToRender, messageMentionedUsersItem),
    [messageMentionedUsersItem, messageTextToRender],
  );

  const firstGroupStyle = groupStyles ? groupStyles[0] : '';

  if (message?.type === 'message.read') {
    return null;
  }

  if (message?.deleted_at) {
    return smartRender(MessageDeleted, props, null);
  }

  if (editing) {
    return (
      <div
        className={`str-chat__message-team str-chat__message-team--${firstGroupStyle} str-chat__message-team--editing`}
        data-testid='message-team-edit'
      >
        {(firstGroupStyle === 'top' || firstGroupStyle === 'single') && (
          <div className='str-chat__message-team-meta'>
            <Avatar
              image={message?.user?.image}
              name={message?.user?.name || message?.user?.id}
              onClick={onUserClick}
              onMouseOver={onUserHover}
              size={40}
            />
          </div>
        )}
        <MessageInput
          clearEditingState={clearEdit}
          Input={EditMessageInput}
          message={message}
          updateMessage={propUpdateMessage || channelUpdateMessage}
        />
      </div>
    );
  }

  return (
    <>
      {message?.pinned && (
        <div className='str-chat__message-team-pin-indicator'>
          <PinIndicator message={message} t={t} />
        </div>
      )}
      <div
        className={`str-chat__message-team str-chat__message-team--${firstGroupStyle} str-chat__message-team--${
          message?.type
        } ${threadList ? 'thread-list' : ''} str-chat__message-team--${
          message?.status
        } ${message?.pinned ? 'pinned-message' : ''}`}
        data-testid='message-team'
        ref={messageWrapperRef}
      >
        <div className='str-chat__message-team-meta'>
          {firstGroupStyle === 'top' ||
          firstGroupStyle === 'single' ||
          initialMessage ? (
            <Avatar
              image={message?.user?.image}
              name={message?.user?.name || message?.user?.id}
              onClick={onUserClick}
              onMouseOver={onUserHover}
              size={40}
            />
          ) : (
            <div
              data-testid='team-meta-spacer'
              style={{ marginRight: 0, width: 40 }}
            />
          )}
          <MessageTimestamp formatDate={formatDate} message={message} />
        </div>
        <div className='str-chat__message-team-group'>
          {message &&
            (firstGroupStyle === 'top' ||
              firstGroupStyle === 'single' ||
              initialMessage) && (
              <div
                className='str-chat__message-team-author'
                data-testid='message-team-author'
                onClick={onUserClick}
              >
                <strong>{message.user?.name || message.user?.id}</strong>
                {message.type === 'error' && (
                  <div className='str-chat__message-team-error-header'>
                    {t('Only visible to you')}
                  </div>
                )}
              </div>
            )}
          <div
            className={`str-chat__message-team-content str-chat__message-team-content--${firstGroupStyle} str-chat__message-team-content--${
              message?.text === '' ? 'image' : 'text'
            }`}
            data-testid='message-team-content'
          >
            {!initialMessage &&
              message &&
              message.status !== 'sending' &&
              message.status !== 'failed' &&
              message.type !== 'system' &&
              message.type !== 'ephemeral' &&
              message.type !== 'error' && (
                <div
                  className={`str-chat__message-team-actions`}
                  data-testid='message-team-actions'
                >
                  {message && showDetailedReactions && (
                    <ReactionSelector
                      detailedView={true}
                      handleReaction={propHandleReaction || handleReaction}
                      latest_reactions={message.latest_reactions}
                      own_reactions={message.own_reactions}
                      reaction_counts={message.reaction_counts || undefined}
                      ref={reactionSelectorRef}
                    />
                  )}

                  {isReactionEnabled && (
                    <span
                      data-testid='message-team-reaction-icon'
                      onClick={onReactionListClick}
                      title='Reactions'
                    >
                      <ReactionIcon />
                    </span>
                  )}
                  {!threadList && channelConfig?.replies !== false && (
                    <span
                      data-testid='message-team-thread-icon'
                      onClick={propHandleOpenThread || handleOpenThread}
                      title='Start a thread'
                    >
                      <ThreadIcon />
                    </span>
                  )}
                  {message &&
                    getMessageActions &&
                    getMessageActions().length > 0 && (
                      <MessageActions
                        addNotification={props.addNotification}
                        customWrapperClass={''}
                        getFlagMessageErrorNotification={
                          props.getFlagMessageErrorNotification
                        }
                        getFlagMessageSuccessNotification={
                          props.getFlagMessageSuccessNotification
                        }
                        getMessageActions={props.getMessageActions}
                        getMuteUserErrorNotification={
                          props.getMuteUserErrorNotification
                        }
                        getMuteUserSuccessNotification={
                          props.getMuteUserSuccessNotification
                        }
                        handleDelete={props.handleDelete}
                        handleEdit={props.handleEdit}
                        handleFlag={props.handleFlag}
                        handleMute={props.handleMute}
                        handlePin={props.handlePin}
                        inline
                        message={message}
                        messageListRect={props.messageListRect}
                        messageWrapperRef={messageWrapperRef}
                        setEditingState={setEdit}
                      />
                    )}
                </div>
              )}
            {message && (
              <span
                className={
                  isOnlyEmojis(message.text)
                    ? 'str-chat__message-team-text--is-emoji'
                    : ''
                }
                data-testid='message-team-message'
                onClick={onMentionsClick}
                onMouseOver={onMentionsHover}
              >
                {unsafeHTML && message.html ? (
                  <div dangerouslySetInnerHTML={{ __html: message.html }} />
                ) : (
                  messageText
                )}
              </span>
            )}

            {message?.mml && (
              <MML
                actionHandler={() => handleAction}
                align='left'
                source={message.mml}
              />
            )}

            {message && message.text === '' && (
              <MessageTeamAttachments
                {...props}
                Attachment={props.Attachment}
                handleAction={propHandleAction || handleAction}
                message={message}
              />
            )}

            {message?.latest_reactions &&
              message.latest_reactions.length !== 0 &&
              message.text !== '' &&
              isReactionEnabled && (
                <ReactionsList
                  handleReaction={() => propHandleReaction || handleReaction}
                  // @ts-expect-error
                  own_reactions={message.own_reactions}
                  reaction_counts={message.reaction_counts || undefined}
                  reactions={message.latest_reactions}
                />
              )}
            {message?.status === 'failed' && (
              <button
                className='str-chat__message-team-failed'
                data-testid='message-team-failed'
                onClick={() => {
                  if (message.status === 'failed' && retry) {
                    retry(message);
                  }
                }}
              >
                <ErrorIcon />
                {t('Message failed. Click to try again.')}
              </button>
            )}
          </div>
          <MessageTeamStatus<At, Ch, Co, Ev, Me, Re, Us>
            {...props}
            Avatar={Avatar}
            lastReceivedId={props.lastReceivedId}
            message={message}
            readBy={props.readBy}
            threadList={threadList}
          />
          {message && message.text !== '' && message.attachments && (
            <MessageTeamAttachments
              {...props}
              Attachment={props.Attachment}
              handleAction={propHandleAction || handleAction}
              message={message}
            />
          )}
          {message?.latest_reactions &&
            message.latest_reactions.length !== 0 &&
            message.text === '' &&
            isReactionEnabled && (
              <ReactionsList
                handleReaction={() => propHandleReaction || handleReaction}
                // @ts-expect-error
                own_reactions={message.own_reactions}
                reaction_counts={message.reaction_counts || undefined}
                reactions={message.latest_reactions}
              />
            )}
          {!threadList && message && (
            <MessageRepliesCountButton
              onClick={propHandleOpenThread || handleOpenThread}
              reply_count={message.reply_count}
            />
          )}
        </div>
      </div>
    </>
  );
};

const MessageTeamStatus = <
  At extends UnknownType = DefaultAttachmentType,
  Ch extends UnknownType = DefaultChannelType,
  Co extends string = DefaultCommandType,
  Ev extends UnknownType = DefaultEventType,
  Me extends UnknownType = DefaultMessageType,
  Re extends UnknownType = DefaultReactionType,
  Us extends DefaultUserType<Us> = DefaultUserType
>({
  Avatar = DefaultAvatar,
  lastReceivedId,
  message,
  readBy,
  threadList,
  t: propT,
}: MessageTeamProps<At, Ch, Co, Ev, Me, Re, Us>) => {
  const { client } = useChatContext<At, Ch, Co, Ev, Me, Re, Us>();
  const { t: contextT } = useTranslationContext();

  const t = propT || contextT;

  const { isMyMessage } = useUserRole(message);

  if (!isMyMessage || message?.type === 'error') {
    return null;
  }
  const justReadByMe =
    readBy &&
    client?.user &&
    readBy.length === 1 &&
    readBy[0] &&
    readBy[0].id === client.user.id;

  if (message && message.status === 'sending') {
    return (
      <span
        className='str-chat__message-team-status'
        data-testid='message-team-sending'
      >
        <Tooltip>{t && t('Sending...')}</Tooltip>
        <LoadingIndicator />
      </span>
    );
  }

  if (readBy && readBy.length !== 0 && !threadList && !justReadByMe) {
    const lastReadUser = readBy.filter(
      (item) => item && client?.user && item.id !== client.user.id,
    )[0];
    return (
      <span className='str-chat__message-team-status'>
        <Tooltip>{getReadByTooltipText(readBy, t, client)}</Tooltip>
        <Avatar
          image={lastReadUser?.image}
          name={lastReadUser?.name}
          size={15}
        />
        {readBy.length - 1 > 1 && (
          <span
            className='str-chat__message-team-status-number'
            data-testid='message-team-read-by-count'
          >
            {readBy.length - 1}
          </span>
        )}
      </span>
    );
  }

  if (
    message &&
    message.status === 'received' &&
    message.id === lastReceivedId &&
    !threadList
  ) {
    return (
      <span
        className='str-chat__message-team-status'
        data-testid='message-team-received'
      >
        <Tooltip>{t && t('Delivered')}</Tooltip>
        <DeliveredCheckIcon />
      </span>
    );
  }

  return null;
};

const MessageTeamAttachments = <
  At extends UnknownType = DefaultAttachmentType,
  Ch extends UnknownType = DefaultChannelType,
  Co extends string = DefaultCommandType,
  Ev extends UnknownType = DefaultEventType,
  Me extends UnknownType = DefaultMessageType,
  Re extends UnknownType = DefaultReactionType,
  Us extends UnknownType = DefaultUserType
>({
  Attachment = DefaultAttachment,
  handleAction,
  message,
}: MessageTeamProps<At, Ch, Co, Ev, Me, Re, Us>) => {
  if (message?.attachments && Attachment) {
    return (
      <Attachment
        actionHandler={handleAction}
        attachments={message.attachments}
      />
    );
  }
  return null;
};

export const MessageTeam = React.memo(
  UnMemoizedMessageTeam,
  areMessagePropsEqual,
) as typeof UnMemoizedMessageTeam;
