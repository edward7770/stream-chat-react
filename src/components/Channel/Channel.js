// @ts-check
import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import PropTypes from 'prop-types';
import Immutable from 'seamless-immutable';
import debounce from 'lodash.debounce';
import throttle from 'lodash.throttle';
import { logChatPromiseExecution, Channel as StreamChannel } from 'stream-chat';

import { ChatContext, ChannelContext, TranslationContext } from '../../context';
import { Attachment as AttachmentComponent } from '../Attachment';
import { MessageSimple as MessageSimpleComponent } from '../Message';
import {
  LoadingIndicator as LoadingIndicatorComponent,
  LoadingErrorIndicator as LoadingErrorIndicatorComponent,
} from '../Loading';
import useMentionsHandlers from './hooks/useMentionsHandlers';
import useEditMessageHandler from './hooks/useEditMessageHandler';

/** @type {React.FC<import('types').ChannelProps>}>} */
const Channel = ({ EmptyPlaceholder = null, ...props }) => {
  const { channel } = useContext(ChatContext);
  if (!channel?.cid) {
    return EmptyPlaceholder;
  }
  return <ChannelInner {...props} channel={channel} key={channel.cid} />;
};

Channel.propTypes = {
  /** Which channel to connect to, will initialize the channel if it's not initialized yet */
  channel: PropTypes.instanceOf(StreamChannel),
  /**
   * Empty channel UI component. This will be shown on the screen if there is no active channel.
   *
   * Defaults to null which skips rendering the Channel
   *
   * */
  EmptyPlaceholder: PropTypes.element,
  /**
   * Error indicator UI component. This will be shown on the screen if channel query fails.
   *
   * Defaults to and accepts same props as: [LoadingErrorIndicator](https://getstream.github.io/stream-chat-react/#loadingerrorindicator)
   *
   * */
  // @ts-ignore elementType
  LoadingErrorIndicator: PropTypes.elementType,
  /**
   * Loading indicator UI component. This will be shown on the screen until the messages are
   * being queried from channelœ. Once the messages are loaded, loading indicator is removed from the screen
   * and replaced with children of the Channel component.
   *
   * Defaults to and accepts same props as: [LoadingIndicator](https://github.com/GetStream/stream-chat-react/blob/master/src/components/LoadingIndicator.js)
   */
  // @ts-ignore elementType
  LoadingIndicator: PropTypes.elementType,
  /**
   * Message UI component to display a message in message list.
   *
   * Available built-in components (also accepts the same props as):
   *
   * 1. [MessageSimple](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageSimple.js) (default)
   * 2. [MessageTeam](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageTeam.js)
   * 3. [MessageLivestream](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageLivestream.js)
   * 3. [MessageCommerce](https://github.com/GetStream/stream-chat-react/blob/master/src/components/MessageCommerce.js)
   *
   * */
  // @ts-ignore elementType
  Message: PropTypes.elementType,
  /**
   * Attachment UI component to display attachment in individual message.
   *
   * Defaults to and accepts same props as: [Attachment](https://github.com/GetStream/stream-chat-react/blob/master/src/components/Attachment.js)
   * */
  // @ts-ignore elementType
  Attachment: PropTypes.elementType,
  /**
   * Handle for click on @mention in message
   *
   * @param {Event} event DOM Click event
   * @param {User} user   Target [user object](https://getstream.io/chat/docs/#chat-doc-set-user) which is clicked
   */
  onMentionsClick: PropTypes.func,
  /**
   * Handle for hover on @mention in message
   *
   * @param {Event} event DOM hover event
   * @param {User} user   Target [user object](https://getstream.io/chat/docs/#chat-doc-set-user) which is hovered
   */
  onMentionsHover: PropTypes.func,
  /** Weather to allow multiple attachment uploads */
  multipleUploads: PropTypes.bool,
  /** List of accepted file types */
  acceptedFiles: PropTypes.array,
  /** Maximum number of attachments allowed per message */
  maxNumberOfFiles: PropTypes.number,
  /** Override send message request (Advanced usage only)
   *
   * @param {String} channelId full channel ID in format of `type:id`
   * @param {Object} message
   */
  doSendMessageRequest: PropTypes.func,
  /** Override update(edit) message request (Advanced usage only)
   *
   * @param {String} channelId full channel ID in format of `type:id`
   * @param {Object} updatedMessage
   */
  doUpdateMessageRequest: PropTypes.func,
};

/**
 * @template T
 * @typedef {{ [user_id: string]: T }} UserMap
 */
/**
 * @template T
 * @typedef {import('seamless-immutable').ImmutableObject<T>} ImmutableObject
 */
/**
 * @template T
 * @typedef {import('seamless-immutable').ImmutableArray<T>} ImmutableArray
 */
/**
 * @typedef {import('stream-chat').TypingStartEvent} TypingStartEvent
 * @typedef {import('stream-chat').Event<TypingStartEvent>} TypingEvent
 * @typedef {import('stream-chat').Member} Member
 * @typedef {import('stream-chat').User} User
 * @typedef {import('stream-chat').UserResponse} UserResponse
 * @typedef {import('stream-chat').MessageResponse} MessageResponse
 */
// TODO: memoize this
/** @type {React.FC<import('types').ChannelProps & { channel: import('stream-chat').Channel }>} */
const ChannelInner = ({
  LoadingIndicator = LoadingIndicatorComponent,
  LoadingErrorIndicator = LoadingErrorIndicatorComponent,
  Attachment = AttachmentComponent,
  Message = MessageSimpleComponent,
  ...props
  // eslint-disable-next-line sonarjs/cognitive-complexity
}) => {
  const { channel } = props;
  const [error, setError] = useState(/** @type {Error | null} */ (null));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [messages, setMessages] = useState(
    Immutable(/** @type {import('stream-chat').MessageResponse[]} */ ([])),
  );
  const [typing, setTyping] = useState(
    Immutable(/** @type {UserMap<ImmutableObject<TypingEvent>>} */ ({})),
  );
  const [members, setMembers] = useState(
    Immutable(/** @type {UserMap<Member>} */ ({})),
  );
  const [watchers, setWatchers] = useState(
    Immutable(/** @type {UserMap<UserResponse>} */ ({})),
  );
  const [watcherCount, setWatcherCount] = useState(0);
  const [read, setRead] = useState(
    Immutable(
      /** @type {UserMap<{ last_read: string, user: UserResponse }>} */ ({}),
    ),
  );
  const [thread, setThread] = useState(
    /** @type {ImmutableObject<MessageResponse> | null} */ (null),
  ); // was false, check if okay
  const [threadMessages, setThreadMessages] = useState(
    /** @type {ImmutableArray<MessageResponse>} */ (Immutable([])),
  );
  const [threadLoadingMore, setThreadLoadingMore] = useState(false);
  const [threadHasMore, setThreadHasMore] = useState(false);
  const originalTitle = useRef('');
  const lastRead = useRef(new Date());
  const chatContext = useContext(ChatContext);
  const { t } = useContext(TranslationContext);

  const throttledCopyStateFromChannel = useCallback(
    throttle(
      () => {
        setMessages(channel.state.messages);
        setWatchers(channel.state.watchers);
        setRead(channel.state.read);
        setTyping(channel.state.typing);
        setWatcherCount(channel.state.watcher_count);
      },
      500,
      { leading: true, trailing: true },
    ),
    [channel],
  );

  const markRead = useCallback(() => {
    if (channel.disconnected || !channel.getConfig().read_events) {
      return;
    }
    lastRead.current = new Date();

    logChatPromiseExecution(channel.markRead(), 'mark read');

    if (originalTitle.current) {
      document.title = originalTitle.current;
    }
  }, [channel]);

  const markReadThrottled = useCallback(
    throttle(markRead, 500, { leading: true, trailing: true }),
    [],
  );

  const handleEvent = useCallback(
    (e) => {
      if (thread) {
        setThreadMessages(channel.state.threads[thread.id] || []);
        if (e.message?.id === thread.id) {
          setThread(channel.state.messageToImmutable(e.message));
        }
      }

      if (e.type === 'message.new') {
        let mainChannelUpdated = true;
        if (e.message.parent_id && !e.message.show_in_channel) {
          mainChannelUpdated = false;
        }

        if (
          mainChannelUpdated &&
          e.message.user.id !== chatContext.client.userID
        ) {
          if (!document.hidden) {
            markReadThrottled();
          } else {
            const unread = channel.countUnread(lastRead.current);
            document.title = `(${unread}) ${originalTitle.current}`;
          }
        }
      }

      throttledCopyStateFromChannel();
    },
    [
      channel,
      chatContext.client.userID,
      throttledCopyStateFromChannel,
      markReadThrottled,
      thread,
    ],
  );

  useEffect(() => {
    let errored = false;
    let done = false;
    const onVisibilityChange = () => {
      if (!document.hidden) {
        markRead();
      }
    };

    (async () => {
      if (!channel.initialized) {
        try {
          await channel.watch();
        } catch (e) {
          setError(e);
          errored = true;
        }
      }
      done = true;
      originalTitle.current = document.title;
      if (!errored) {
        setMessages(channel.state.messages);
        setRead(channel.state.read);
        setWatchers(channel.state.watchers);
        setMembers(channel.state.members);
        setWatcherCount(channel.state.watcher_count);
        setLoading(false);
        if (channel.countUnread() > 0) channel.markRead();
        // The more complex sync logic is done in chat.js
        // listen to client.connection.recovered and all channel events
        document.addEventListener('visibilitychange', onVisibilityChange);
        chatContext.client.on('connection.recovered', handleEvent);
        channel.on(handleEvent);
      }
    })();
    return () => {
      if (errored || !done) return;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      channel.off(handleEvent);
      chatContext.client.off('connection.recovered', handleEvent);
    };
  }, [channel, chatContext.client, handleEvent, markRead, props.channel]);

  useEffect(() => {
    if (thread) {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].id === thread.id) {
          setThread(messages[i]);
          break;
        }
      }
    }
  }, [thread, messages]);

  const loadMoreFinished = useCallback(
    debounce(
      /**
       * @param {boolean} hasMoreMessages
       * @param {ImmutableArray<MessageResponse>} newMessages
       */
      (hasMoreMessages, newMessages) => {
        setLoadingMore(false);
        setHasMore(hasMoreMessages);
        setMessages(newMessages);
      },
      2000,
      {
        leading: true,
        trailing: true,
      },
    ),
    [],
  );

  const loadMore = useCallback(
    async (limit = 100) => {
      // prevent duplicate loading events...
      const oldestMessage = messages[0];
      if (loadingMore || oldestMessage?.status !== 'received') return;
      setLoadingMore(true);

      const oldestID = oldestMessage?.id || null;

      const perPage = limit;
      let queryResponse;
      try {
        queryResponse = await channel.query({
          messages: { limit: perPage, id_lt: oldestID },
        });
      } catch (e) {
        console.warn('message pagination request failed with error', e);
        setLoadingMore(false);
        return;
      }
      const hasMoreMessages = queryResponse.messages.length === perPage;

      loadMoreFinished(hasMoreMessages, channel.state.messages);
    },
    [channel, loadMoreFinished, loadingMore, messages],
  );

  const updateMessage = useCallback(
    (updatedMessage) => {
      // adds the message to the local channel state..
      // this adds to both the main channel state as well as any reply threads
      channel.state.addMessageSorted(updatedMessage);

      // update the Channel component state
      if (thread && updatedMessage.parent_id) {
        setThreadMessages(
          channel.state.threads[updatedMessage.parent_id] || [],
        );
      }
      setMessages(channel.state.messages);
    },
    [channel.state, thread],
  );

  const { doSendMessageRequest } = props;
  const doSendMessage = useCallback(
    async (message) => {
      const { text, attachments, id, parent_id, mentioned_users } = message;
      const messageData = {
        text,
        attachments,
        mentioned_users,
        id,
        parent_id,
      };

      try {
        let messageResponse;
        if (doSendMessageRequest) {
          messageResponse = await doSendMessageRequest(
            channel.cid,
            messageData,
          );
        } else {
          messageResponse = await channel.sendMessage(messageData);
        }

        // replace it after send is completed
        if (messageResponse && messageResponse.message) {
          updateMessage({
            ...messageResponse.message,
            status: 'received',
          });
        }
      } catch (e) {
        // set the message to failed..
        updateMessage({
          ...message,
          status: 'failed',
        });
      }
    },
    [channel, doSendMessageRequest, updateMessage],
  );

  const createMessagePreview = useCallback(
    (text, attachments, parent, mentioned_users) => {
      // create a preview of the message
      const clientSideID = `${chatContext.client.userID}-${uuidv4()}`;
      return {
        text,
        html: text,
        __html: text,
        id: clientSideID,
        type: 'regular',
        status: 'sending',
        user: chatContext.client.user,
        created_at: new Date(),
        attachments,
        mentioned_users,
        reactions: [],
        ...(parent?.id ? { parent_id: parent.id } : null),
      };
    },
    [chatContext.client.user, chatContext.client.userID],
  );

  const sendMessage = useCallback(
    async ({ text, attachments = [], mentioned_users = [], parent }) => {
      // remove error messages upon submit
      channel.state.filterErrorMessages();

      // create a local preview message to show in the UI
      const messagePreview = createMessagePreview(
        text,
        attachments,
        parent,
        mentioned_users,
      );

      // first we add the message to the UI
      updateMessage(messagePreview);

      await doSendMessage(messagePreview);
    },
    [channel.state, createMessagePreview, doSendMessage, updateMessage],
  );

  const retrySendMessage = useCallback(
    async (message) => {
      // set the message status to sending
      updateMessage({
        ...message,
        status: 'sending',
      });
      // actually try to send the message...
      await doSendMessage(message);
    },
    [doSendMessage, updateMessage],
  );

  const removeMessage = useCallback(
    (message) => {
      channel.state.removeMessage(message);
      setMessages(channel.state.messages);
      setThreadMessages(channel.state.threads[message.parent_id] || []);
    },
    [channel.state],
  );

  const openThread = useCallback(
    (message, e) => {
      if (e && e.preventDefault) {
        e.preventDefault();
      }

      setThread(message);
      setThreadMessages(channel.state.threads[message.id] || []);
    },
    [channel.state.threads],
  );

  const loadMoreThreadFinished = useCallback(
    debounce(
      /**
       * @param {boolean} threadHasMoreMessages
       * @param {ImmutableArray<MessageResponse>} newThreadMessages
       */
      (threadHasMoreMessages, newThreadMessages) => {
        setThreadHasMore(threadHasMoreMessages);
        setThreadMessages(newThreadMessages);
        setThreadLoadingMore(false);
      },
      2000,
      { leading: true, trailing: true },
    ),
    [],
  );

  const loadMoreThread = useCallback(async () => {
    // prevent duplicate loading events...
    if (threadLoadingMore || !thread) return;
    setThreadLoadingMore(true);
    const parentID = thread.id;
    const oldMessages = channel.state.threads[parentID] || [];
    const oldestMessageID = oldMessages[0] ? oldMessages[0].id : null;
    const limit = 50;
    const queryResponse = await channel.getReplies(parentID, {
      limit,
      id_lt: oldestMessageID,
    });

    const threadHasMoreMessages = queryResponse.messages.length === limit;

    const newThreadMessages = channel.state.threads[parentID] || [];

    // next set loadingMore to false so we can start asking for more data...
    loadMoreThreadFinished(threadHasMoreMessages, newThreadMessages);
  }, [channel, loadMoreThreadFinished, thread, threadLoadingMore]);

  const closeThread = useCallback((e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    setThread(null);
    setThreadMessages(Immutable([]));
  }, []);

  const onMentionsHoverOrClick = useMentionsHandlers(
    props.onMentionsHover,
    props.onMentionsClick,
  );

  const editMessage = useEditMessageHandler(props.doUpdateMessageRequest);

  const channelContextValue = {
    // state
    error,
    loading,
    loadingMore,
    hasMore,
    messages,
    typing,
    members,
    watchers,
    read,
    thread,
    threadMessages,
    threadLoadingMore,
    threadHasMore,
    watcher_count: watcherCount,
    // props
    channel,
    Message,
    Attachment,
    multipleUploads: props.multipleUploads,
    acceptedFiles: props.acceptedFiles,
    maxNumberOfFiles: props.maxNumberOfFiles,
    mutes: props.mutes,
    // handlers
    loadMore,
    editMessage,
    updateMessage,
    sendMessage,
    retrySendMessage,
    removeMessage,
    openThread,
    loadMoreThread,
    closeThread,
    onMentionsClick: onMentionsHoverOrClick,
    onMentionsHover: onMentionsHoverOrClick,
    // from chatContext, for legacy reasons
    client: chatContext.client,
  };

  let core;
  if (error) {
    core = <LoadingErrorIndicator error={error} />;
  } else if (loading) {
    core = <LoadingIndicator size={25} />;
  } else if (!props.channel?.watch) {
    core = <div>{t('Channel Missing')}</div>;
  } else {
    core = (
      <ChannelContext.Provider value={channelContextValue}>
        <div className="str-chat__container">{props.children}</div>
      </ChannelContext.Provider>
    );
  }

  return (
    <div className={`str-chat str-chat-channel ${props.theme}`}>{core}</div>
  );
};

export default React.memo(Channel);
