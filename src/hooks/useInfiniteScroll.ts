import { useRef } from '../lib/teact/teact';

import { LoadMoreDirection } from '../global/types';

import { areSortedArraysEqual } from '../util/iteratees';
import useForceUpdate from './useForceUpdate';
import useLastCallback from './useLastCallback';
import usePrevious from './usePrevious';

type GetMore = (args: { direction: LoadMoreDirection }) => void;
type ResetScroll = () => void;
type LoadMoreBackwards = (args: { offsetId?: string | number }) => void;

const DEFAULT_LIST_SLICE = 30;

const useInfiniteScroll = <ListId extends string | number>(
  loadMoreBackwards?: LoadMoreBackwards,
  listIds?: ListId[],
  isDisabled = false,
  listSlice = DEFAULT_LIST_SLICE,
): [ListId[]?, GetMore?, ResetScroll?] => {
  const requestParamsRef = useRef<{
    direction?: LoadMoreDirection;
    offsetId?: ListId;
  }>();

  const currentStateRef = useRef<{ viewportIds: ListId[]; isOnTop: boolean } | undefined>();
  if (!currentStateRef.current && listIds && !isDisabled) {
    const {
      newViewportIds,
      newIsOnTop,
    } = getViewportSlice(listIds, LoadMoreDirection.Forwards, listSlice, listIds[0]);
    currentStateRef.current = { viewportIds: newViewportIds, isOnTop: newIsOnTop };
  }

  const forceUpdate = useForceUpdate();

  if (isDisabled) {
    requestParamsRef.current = {};
  }

  const prevListIds = usePrevious(listIds);
  const prevIsDisabled = usePrevious(isDisabled);
  const areListsEqual = listIds && prevListIds
    && listIds.length > 0 && prevListIds.length > 0
    && listIds[0] === prevListIds[0]
    && listIds[listIds.length - 1] === prevListIds[prevListIds.length - 1];

  if (listIds && !isDisabled && (!areListsEqual || isDisabled !== prevIsDisabled)) {
    const { viewportIds, isOnTop } = currentStateRef.current || {};
    const currentMiddleId = viewportIds && !isOnTop ? viewportIds[Math.round(viewportIds.length / 2)] : undefined;
    const defaultOffsetId = currentMiddleId && listIds.includes(currentMiddleId) ? currentMiddleId : listIds[0];
    const { offsetId = defaultOffsetId, direction = LoadMoreDirection.Forwards } = requestParamsRef.current || {};
    const { newViewportIds, newIsOnTop } = getViewportSlice(listIds, direction, listSlice, offsetId);

    requestParamsRef.current = {};

    if (!viewportIds || !areSortedArraysEqual(viewportIds, newViewportIds)) {
      currentStateRef.current = { viewportIds: newViewportIds, isOnTop: newIsOnTop };
    }
  } else if (!listIds) {
    currentStateRef.current = undefined;
  }

  const getMore: GetMore = useLastCallback(({
    direction,
  }: { direction: LoadMoreDirection; noScroll?: boolean }) => {
    const { viewportIds } = currentStateRef.current || {};

    const offsetId = viewportIds
      ? direction === LoadMoreDirection.Backwards ? viewportIds[viewportIds.length - 1] : viewportIds[0]
      : undefined;

    requestParamsRef.current = { direction, offsetId };

    if (!listIds) {
      if (loadMoreBackwards) {
        loadMoreBackwards({ offsetId });
      }

      return;
    }

    const {
      newViewportIds, areSomeLocal, areAllLocal, newIsOnTop,
    } = getViewportSlice(listIds, direction, listSlice, offsetId);

    if (areSomeLocal && !(viewportIds && areSortedArraysEqual(viewportIds, newViewportIds))) {
      currentStateRef.current = { viewportIds: newViewportIds, isOnTop: newIsOnTop };
      forceUpdate();
    }

    if (!areAllLocal && loadMoreBackwards) {
      loadMoreBackwards({ offsetId });
    }
  });

  const resetScroll: ResetScroll = useLastCallback(() => {
    if (!listIds?.length) return;

    const {
      newViewportIds,
      newIsOnTop,
    } = getViewportSlice(listIds, LoadMoreDirection.Forwards, listSlice, listIds[0]);

    currentStateRef.current = { viewportIds: newViewportIds, isOnTop: newIsOnTop };
    requestParamsRef.current = {};
  });

  return isDisabled ? [listIds] : [currentStateRef.current?.viewportIds, getMore, resetScroll];
};

function getViewportSlice<ListId extends string | number>(
  sourceIds: ListId[],
  direction: LoadMoreDirection,
  listSlice: number,
  offsetId?: ListId,
) {
  const { length } = sourceIds;
  const index = offsetId ? sourceIds.indexOf(offsetId) : 0;
  const isForwards = direction === LoadMoreDirection.Forwards;
  const indexForDirection = isForwards ? index : (index + 1) || length;
  const from = Math.max(0, indexForDirection - listSlice);
  const to = indexForDirection + listSlice - 1;
  const newViewportIds = sourceIds.slice(Math.max(0, from), to + 1);

  let areSomeLocal;
  let areAllLocal;
  switch (direction) {
    case LoadMoreDirection.Forwards:
      areSomeLocal = indexForDirection >= 0;
      areAllLocal = from >= 0;
      break;
    case LoadMoreDirection.Backwards:
      areSomeLocal = indexForDirection < length;
      areAllLocal = to <= length - 1;
      break;
  }

  return {
    newViewportIds,
    areSomeLocal,
    areAllLocal,
    newIsOnTop: newViewportIds[0] === sourceIds[0],
  };
}

export default useInfiniteScroll;
