import type { Ref, RefObject } from 'react';
import type { TeactNode } from '../../../../lib/teact/teact';
import React, { memo } from '../../../../lib/teact/teact';

import type { ApiSwapActivity, ApiSwapAsset } from '../../../../api/types';

import { TON_SYMBOL, TON_TOKEN_SLUG } from '../../../../config';
import buildClassName from '../../../../util/buildClassName';
import { formatTime } from '../../../../util/dateFormat';
import { formatCurrencyExtended } from '../../../../util/formatNumber';
import getSwapRate from '../../../../util/swap/getSwapRate';

import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

import Button from '../../../ui/Button';

import styles from './Transaction.module.scss';

type OwnProps = {
  ref?: Ref<HTMLElement>;
  tokensBySlug?: Record<string, ApiSwapAsset>;
  isLast: boolean;
  activity: ApiSwapActivity;
  isActive: boolean;
  onClick: (id: string) => void;
};

const CHANGELLY_PENDING_STATUSES = new Set(['new', 'waiting', 'confirming', 'exchanging', 'sending', 'hold']);
const CHANGELLY_EXPIRED_STATUSES = new Set(['failed', 'expired', 'refunded', 'overdue']);
const ONCHAIN_ERROR_STATUSES = new Set(['expired', 'failed']);

function Swap({
  ref,
  tokensBySlug,
  activity,
  isLast,
  isActive,
  onClick,
}: OwnProps) {
  const lang = useLang();

  const {
    id,
    timestamp,
    status,
    from,
    to,
    cex,
  } = activity;

  const fromToken = tokensBySlug?.[from];
  const toToken = tokensBySlug?.[to];
  const fromAmount = Number(activity.fromAmount);
  const toAmount = Number(activity.toAmount);
  const isPending = status === 'pending'
    || CHANGELLY_PENDING_STATUSES.has(cex?.status ?? '');
  const isError = ONCHAIN_ERROR_STATUSES.has(status)
    || CHANGELLY_EXPIRED_STATUSES.has(cex?.status ?? '');
  const isHold = cex?.status === 'hold';

  const isFromTon = from === TON_TOKEN_SLUG;

  const handleClick = useLastCallback(() => {
    onClick(id);
  });

  const swapIconClass = buildClassName(
    'icon-swap',
    styles.icon_swap,
    isError && styles.icon_error,
  );

  const iconFullClass = buildClassName(
    styles.icon,
    swapIconClass,
  );

  function renderAmount() {
    const amountSwapClass = buildClassName(
      styles.amount,
      styles.swapAmount,
    );

    return (
      <div className={styles.amountWrapper}>
        <div className={amountSwapClass}>
          <span className={buildClassName(styles.swapSell, isError && styles.swapError)}>
            {formatCurrencyExtended(
              Math.abs(fromAmount),
              fromToken?.symbol || TON_SYMBOL,
              true,
            )}
          </span>
          <i
            className={buildClassName(
              styles.swapArrowRight,
              'icon-arrow-right',
              isError && styles.swapError,
              isHold && styles.swapHold,
            )}
            aria-hidden
          />
          <span className={buildClassName(
            styles.swapBuy,
            isError && styles.swapError,
            isHold && styles.swapHold,
          )}
          >
            {formatCurrencyExtended(
              Math.abs(toAmount),
              toToken?.symbol || TON_SYMBOL,
              true,
            )}
          </span>
        </div>
        {renderCurrency(activity, fromToken, toToken)}
      </div>
    );
  }

  function renderErrorMessage() {
    let text: string | TeactNode[] = formatTime(timestamp);
    const cexStatus = cex?.status;

    if (cexStatus === 'expired' || cexStatus === 'overdue') {
      text = lang('Expired');
    } else if (cexStatus === 'refunded') {
      text = lang('Refunded');
    } else if (cexStatus === 'hold') {
      text = lang('On hold');
    } else if (cexStatus === 'failed' || isError) {
      text = lang('Failed');
    } else if (cexStatus === 'waiting' && !isFromTon) {
      // Skip the 'waiting' status for transactions from TON to account for delayed status updates from changelly.
      text = lang('Waiting for payment');
    } else if (isPending) {
      text = lang('Waiting for payment');
    }

    return (
      <div className={buildClassName(
        styles.date,
        isError && styles.isSwapErrorMessage,
      )}
      >
        {text}
      </div>
    );
  }

  function renderTitle() {
    if (isHold || isError) {
      return lang('Swap');
    } else if (isPending) {
      return lang('Swapping');
    }

    return lang('Swapped');
  }

  return (
    <Button
      ref={ref as RefObject<HTMLButtonElement>}
      key={id}
      className={buildClassName(
        styles.item,
        isLast && styles.itemLast,
        isActive && styles.active,
      )}
      onClick={handleClick}
      isSimple
    >
      <i className={iconFullClass} aria-hidden />
      {isPending && (
        <i
          className={buildClassName(styles.iconWaiting, styles.iconWaitingSwap, 'icon-clock')}
          title={lang('Swap is not completed')}
          aria-hidden
        />
      )}
      {isError && (
        <i
          className={buildClassName(styles.iconError, 'icon-close-filled')}
          title={lang('Swap is not completed')}
          aria-hidden
        />
      )}
      <div className={styles.leftBlock}>
        <div className={styles.operationName}>
          {renderTitle()}
        </div>
        {renderErrorMessage()}
      </div>
      {renderAmount()}
      <i className={buildClassName(styles.iconArrow, 'icon-chevron-right')} aria-hidden />
    </Button>
  );
}

export default memo(Swap);

function renderCurrency(activity: ApiSwapActivity, fromToken?: ApiSwapAsset, toToken?: ApiSwapAsset) {
  const rate = getSwapRate(activity.fromAmount, activity.toAmount, fromToken, toToken);

  if (!rate) return undefined;

  return (
    <div
      className={styles.swapPrice}
    >
      {rate.firstCurrencySymbol}{' ≈ '}
      <span
        className={styles.swapPriceValue}
      >
        {rate.price}{' '}{rate.secondCurrencySymbol}
      </span>
    </div>
  );
}
