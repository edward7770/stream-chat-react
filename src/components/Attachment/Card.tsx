import React from 'react';
import clsx from 'clsx';
import ReactPlayer from 'react-player';

import { AudioProps, PlayButton, ProgressBar } from './Audio';
import { SafeAnchor } from '../SafeAnchor';
import { useAudioController } from './hooks/useAudioController';

import { useChatContext } from '../../context/ChatContext';
import { useChannelStateContext } from '../../context/ChannelStateContext';
import { useTranslationContext } from '../../context/TranslationContext';

import type { Attachment } from 'stream-chat';
import type { RenderAttachmentProps } from './utils';

const trimUrl = (url?: string | null) => {
  if (url !== undefined && url !== null) {
    const [trimmedUrl] = url.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').split('/');

    return trimmedUrl;
  }
  return null;
};

const UnableToRenderCard = ({ type }: { type?: CardProps['type'] }) => {
  const { t } = useTranslationContext('Card');

  return (
    <div
      className={clsx('str-chat__message-attachment-card', {
        [`str-chat__message-attachment-card--${type}`]: type,
      })}
    >
      <div className='str-chat__message-attachment-card--content'>
        <div className='str-chat__message-attachment-card--text'>
          {t<string>('this content could not be displayed')}
        </div>
      </div>
    </div>
  );
};

type Dimensions = { height?: string; width?: string };

interface CardV1Props {
  giphy?: Attachment['giphy'];
  /** The url of the full sized image */
  image_url?: string;
  /** The scraped url, used as a fallback if the OG-data doesn't include a link */
  og_scrape_url?: string;
  /** Description returned by the OG scraper */
  text?: string;
  /** The url for thumbnail sized image */
  thumb_url?: string;
  /** Title returned by the OG scraper */
  title?: string;
  /** Link returned by the OG scraper */
  title_link?: string;
  /** The card type used in the className attribute */
  type?: string;
}

const CardV1 = (props: CardV1Props) => {
  const { giphy, image_url, og_scrape_url, text, thumb_url, title, title_link, type } = props;
  const { giphyVersion: giphyVersionName } = useChannelStateContext('Card');

  let image = thumb_url || image_url;
  const dimensions: Dimensions = {};

  if (type === 'giphy' && typeof giphy !== 'undefined') {
    const giphyVersion = giphy[giphyVersionName as keyof NonNullable<Attachment['giphy']>];
    image = giphyVersion.url;
    dimensions.height = giphyVersion.height;
    dimensions.width = giphyVersion.width;
  }

  if (!title && !title_link && !image) {
    return <UnableToRenderCard type={type} />;
  }

  if (!title_link && !og_scrape_url) {
    return null;
  }

  return (
    <div className={`str-chat__message-attachment-card str-chat__message-attachment-card--${type}`}>
      {image && (
        <div className='str-chat__message-attachment-card--header'>
          <img alt={image} src={image} {...dimensions} />
        </div>
      )}
      <div className='str-chat__message-attachment-card--content'>
        <div className='str-chat__message-attachment-card--flex'>
          {title && <div className='str-chat__message-attachment-card--title'>{title}</div>}
          {text && <div className='str-chat__message-attachment-card--text'>{text}</div>}
          {(title_link || og_scrape_url) && (
            <SafeAnchor
              className='str-chat__message-attachment-card--url'
              href={title_link || og_scrape_url}
              rel='noopener noreferrer'
              target='_blank'
            >
              {trimUrl(title_link || og_scrape_url)}
            </SafeAnchor>
          )}
        </div>
      </div>
    </div>
  );
};

const SourceLink = ({ author_name, url }: Pick<CardProps, 'author_name'> & { url: string }) => (
  <div className='str-chat__message-attachment-card--source-link' data-testid='card-source-link'>
    <SafeAnchor
      className='str-chat__message-attachment-card--url'
      href={url}
      rel='noopener noreferrer'
      target='_blank'
    >
      {author_name || trimUrl(url)}
    </SafeAnchor>
  </div>
);

type CardHeaderProps = Pick<CardProps, 'asset_url' | 'title' | 'type'> & {
  dimensions: Dimensions;
  image?: string;
};

const CardHeader = (props: CardHeaderProps) => {
  const { asset_url, dimensions, image, title, type } = props;

  let visual = null;
  if (asset_url && type === 'video') {
    visual = (
      <ReactPlayer className='react-player' controls height='100%' url={asset_url} width='100%' />
    );
  } else if (image) {
    visual = <img alt={title || image} src={image} {...dimensions} />;
  }

  return visual ? (
    <div className='str-chat__message-attachment-card--header' data-testid={'card-header'}>
      {visual}
    </div>
  ) : null;
};

type CardContentProps = RenderAttachmentProps['attachment'];

const CardContent = (props: CardContentProps) => {
  const { author_name, og_scrape_url, text, title, title_link, type } = props;
  const url = og_scrape_url || title_link;

  return (
    <div className='str-chat__message-attachment-card--content'>
      {type === 'audio' ? (
        <CardAudio og={props} />
      ) : (
        <div className='str-chat__message-attachment-card--flex'>
          {url && <SourceLink author_name={author_name} url={url} />}
          {title && <div className='str-chat__message-attachment-card--title'>{title}</div>}
          {text && <div className='str-chat__message-attachment-card--text'>{text}</div>}
        </div>
      )}
    </div>
  );
};

const CardV2 = (props: CardProps) => {
  const { asset_url, giphy, image_url, thumb_url, title, title_link, type } = props;
  const { giphyVersion: giphyVersionName } = useChannelStateContext('CardHeader');

  let image = thumb_url || image_url;
  const dimensions: { height?: string; width?: string } = {};

  if (type === 'giphy' && typeof giphy !== 'undefined') {
    const giphyVersion = giphy[giphyVersionName as keyof NonNullable<Attachment['giphy']>];
    image = giphyVersion.url;
    dimensions.height = giphyVersion.height;
    dimensions.width = giphyVersion.width;
  }

  if (!title && !title_link && !asset_url && !image) {
    return <UnableToRenderCard />;
  }

  return (
    <div className={`str-chat__message-attachment-card str-chat__message-attachment-card--${type}`}>
      <CardHeader {...props} dimensions={dimensions} image={image} />
      <CardContent {...props} />
    </div>
  );
};

export const CardAudio = ({
  og: { asset_url, author_name, og_scrape_url, text, title, title_link },
}: AudioProps) => {
  const { audioRef, isPlaying, progress, togglePlay } = useAudioController();

  const url = og_scrape_url || title_link;
  const dataTestId = 'card-audio-widget';
  const rootClassName = 'str-chat__message-attachment-card-audio-widget';
  return (
    <div className={rootClassName} data-testid={dataTestId}>
      {asset_url && (
        <>
          <audio ref={audioRef}>
            <source data-testid='audio-source' src={asset_url} type='audio/mp3' />
          </audio>
          <div className='str-chat__message-attachment-card-audio-widget--first-row'>
            <div className='str-chat__message-attachment-audio-widget--play-controls'>
              <PlayButton isPlaying={isPlaying} onClick={togglePlay} />
            </div>
            <ProgressBar progress={progress} />
          </div>
        </>
      )}
      <div className='str-chat__message-attachment-audio-widget--second-row'>
        {url && <SourceLink author_name={author_name} url={url} />}
        {title && <div className='str-chat__message-attachment-audio-widget--title'>{title}</div>}
        {text && (
          <div className='str-chat__message-attachment-audio-widget--description'>{text}</div>
        )}
      </div>
    </div>
  );
};

export type CardProps = RenderAttachmentProps['attachment'];

const UnMemoizedCard = (props: CardProps) => {
  const { themeVersion } = useChatContext('Card');

  return themeVersion === '2' ? <CardV2 {...props} /> : <CardV1 {...props} />;
};

/**
 * Simple Card Layout for displaying links
 */
export const Card = React.memo(UnMemoizedCard) as typeof UnMemoizedCard;
