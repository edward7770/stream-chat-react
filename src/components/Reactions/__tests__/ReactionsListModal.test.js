import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { toHaveNoViolations } from 'jest-axe';

import { axe } from '../../../../axe-helper';
expect.extend(toHaveNoViolations);

import { ReactionsList } from '../ReactionsList';
import { MessageProvider } from '../../../context/MessageContext';

import { generateReactions, generateUser } from '../../../mock-builders';
import { ComponentProvider } from '../../../context';
import { defaultReactionOptions } from '../reactionOptions';

const generateReactionsFromReactionCounts = (reactionCounts) =>
  Object.entries(reactionCounts).flatMap(([type, count]) =>
    generateReactions(count, (i) => ({
      type,
      user: generateUser({ id: `mark-${i}`, name: `Mark Number ${i}` }),
    })),
  );

const renderComponent = ({ handleFetchReactions, ...props }) =>
  render(
    <ComponentProvider value={{ reactionOptions: defaultReactionOptions }}>
      <MessageProvider value={{}}>
        <ReactionsList handleFetchReactions={handleFetchReactions} {...props} />,
      </MessageProvider>
    </ComponentProvider>,
  );

describe('ReactionsListModal', () => {
  beforeEach(() => {
    // disable warnings (unreachable context)
    jest.spyOn(console, 'warn').mockImplementation(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should show reactions modal when a reaction is clicked', async () => {
    const reactionCounts = {
      haha: 2,
      love: 5,
    };
    const { container, getByTestId, queryByTestId } = renderComponent({
      reaction_counts: reactionCounts,
      reactions: generateReactionsFromReactionCounts(reactionCounts),
    });

    expect(queryByTestId('reactions-list-modal')).not.toBeInTheDocument();
    await act(() => {
      fireEvent.click(getByTestId('reactions-list-button-haha'));
    });

    expect(getByTestId('reactions-list-modal')).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should display a list of reactions in a modal', async () => {
    const reactionCounts = {
      haha: 2,
      love: 5,
    };
    const reactions = generateReactionsFromReactionCounts(reactionCounts);
    const fetchReactions = jest.fn(() => Promise.resolve(reactions));

    const { container, getAllByTestId, getByTestId } = renderComponent({
      handleFetchReactions: fetchReactions,
      reaction_counts: reactionCounts,
      reactions,
    });

    await act(() => {
      fireEvent.click(getByTestId('reactions-list-button-haha'));
    });
    expect(getAllByTestId('reaction-user-username')).toHaveLength(2);

    await act(() => {
      fireEvent.click(getByTestId('reaction-details-selector-love'));
    });
    expect(getAllByTestId('reaction-user-username')).toHaveLength(5);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('should close reactions list modal when close button is clicked', async () => {
    const reactionCounts = {
      haha: 2,
      love: 5,
    };
    const { getByTestId, getByTitle, queryByTestId } = renderComponent({
      reaction_counts: reactionCounts,
      reactions: generateReactionsFromReactionCounts(reactionCounts),
    });

    await act(() => {
      fireEvent.click(getByTestId('reactions-list-button-haha'));
    });
    expect(getByTestId('reactions-list-modal')).toBeInTheDocument();
    await act(() => {
      fireEvent.click(getByTitle('Close'));
    });
    expect(queryByTestId('reactions-list-modal')).not.toBeInTheDocument();
  });

  it('should not allow opening reactions list modal when the reactions count is too high', async () => {
    const reactionCounts = {
      haha: 2000,
      love: 5000,
    };
    const { getByTestId, queryByTestId } = renderComponent({
      reaction_counts: reactionCounts,
      reactions: generateReactionsFromReactionCounts(reactionCounts),
    });

    await act(() => {
      fireEvent.click(getByTestId('reactions-list-button-haha'));
    });
    expect(queryByTestId('reactions-list-modal')).not.toBeInTheDocument();
  });
});
