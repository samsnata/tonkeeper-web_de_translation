import React, { FC, useId, useRef, useState } from 'react';
import { ControllerFieldState, ControllerRenderProps } from 'react-hook-form/dist/types/controller';
import { FieldValues } from 'react-hook-form';
import { useAppContext } from '../../../hooks/appContext';
import { useRate } from '../../../state/rates';
import {
    replaceTypedDecimalSeparator,
    seeIfValueValid
} from '../../transfer/amountView/AmountViewUI';
import { formatSendValue, isNumeric, removeGroupSeparator } from '@tonkeeper/core/dist/utils/send';
import { getDecimalSeparator } from '@tonkeeper/core/dist/utils/formatting';
import BigNumber from 'bignumber.js';
import { formatter } from '../../../hooks/balance';
import { InputBlockStyled, InputFieldStyled } from './InputStyled';
import styled, { css } from 'styled-components';
import { Body2 } from '../../Text';

const AmountInputFieldStyled = styled(InputFieldStyled)<{ color?: string }>`
    text-align: right;

    transition: color 0.1s ease-in-out;

    ${p =>
        p.color &&
        css`
            color: ${p.theme[p.color]};
        `};
`;

const AmountInputFieldRight = styled(Body2)<{ color?: string }>`
    height: fit-content;
    align-self: center;

    transition: color 0.1s ease-in-out;

    ${p =>
        p.color &&
        css`
            color: ${p.theme[p.color]};
        `};
`;

export const AmountInput: FC<{
    field: ControllerRenderProps<FieldValues, `row.${string}.value`>;
    token: {
        symbol: string;
        address: string;
        decimals: number;
    };
    fieldState: ControllerFieldState;
}> = ({ token, fieldState, field }) => {
    const { fiat } = useAppContext();
    const [focus, setFocus] = useState(false);
    const [currencyAmount, setCurrencyAmount] = useState({
        inFiat: false,
        tokenValue: '',
        fiatValue: '',
        inputValue: ''
    });
    const { data } = useRate(token.address);
    const price = data?.prices || 1;

    const onInput = (inFiat: boolean, newValue: string) => {
        const decimals = currencyAmount.inFiat ? 2 : token.decimals;

        let inputValue = replaceTypedDecimalSeparator(newValue);

        if (!inputValue) {
            setCurrencyAmount(s => ({
                ...s,
                inputValue,
                tokenValue: '',
                fiatValue: ''
            }));
            return;
        }

        if (!seeIfValueValid(inputValue, decimals)) {
            return;
        }

        let tokenValue = currencyAmount.tokenValue;
        let fiatValue = currencyAmount.fiatValue;

        if (isNumeric(inputValue) && !inputValue.endsWith(getDecimalSeparator())) {
            const formattedInput = formatSendValue(inputValue);
            const bnInput = new BigNumber(
                removeGroupSeparator(inputValue).replace(getDecimalSeparator(), '.')
            );
            if (inFiat) {
                tokenValue = formatter.format(bnInput.div(price), { decimals: token.decimals });

                fiatValue = formattedInput;
            } else {
                fiatValue = formatter.format(bnInput.multipliedBy(price), { decimals: 2 });

                tokenValue = formattedInput;
            }

            inputValue = formatSendValue(inputValue);
        }

        setCurrencyAmount({
            inFiat,
            inputValue,
            tokenValue,
            fiatValue
        });
    };

    const tokenId = useId();
    const fiatId = useId();
    const tokenRef = useRef<HTMLInputElement | null>(null);
    const fiatRef = useRef<HTMLInputElement | null>(null);

    const onFocus = (inFiat: boolean) => {
        setFocus(true);
        if (inFiat !== currencyAmount.inFiat) {
            setCurrencyAmount(s => ({
                ...s,
                inFiat,
                inputValue: inFiat ? s.fiatValue : s.tokenValue
            }));
        }
    };

    const onBlur = () => {
        const activeId = document.activeElement?.id;
        if (activeId !== tokenId && activeId !== fiatId) {
            setFocus(false);
            field.onBlur();
        }
    };

    return (
        <InputBlockStyled valid={!fieldState.invalid} focus={focus}>
            <AmountInputFieldStyled
                id={tokenId}
                onFocus={() => onFocus(false)}
                onBlur={onBlur}
                placeholder="0"
                onChange={e => onInput(false, e.target.value)}
                value={
                    currencyAmount.inFiat ? currencyAmount.tokenValue : currencyAmount.inputValue
                }
                color={currencyAmount.inFiat ? 'textTertiary' : 'textPrimary'}
                type="text"
                ref={tokenRef}
            />
            <AmountInputFieldRight
                color={
                    currencyAmount.inFiat || (!currencyAmount.inputValue && !focus)
                        ? 'textTertiary'
                        : 'textPrimary'
                }
                onClick={() => {
                    tokenRef.current?.focus();
                    onFocus(false);
                }}
            >
                {token.symbol}
            </AmountInputFieldRight>
            <AmountInputFieldStyled
                id={fiatId}
                onFocus={() => onFocus(true)}
                onBlur={onBlur}
                placeholder="0"
                onChange={e => onInput(true, e.target.value)}
                value={currencyAmount.inFiat ? currencyAmount.inputValue : currencyAmount.fiatValue}
                color={currencyAmount.inFiat ? 'textPrimary' : 'textTertiary'}
                type="text"
                autoComplete="off"
                ref={fiatRef}
            />
            <AmountInputFieldRight
                color={currencyAmount.inFiat ? 'textPrimary' : 'textTertiary'}
                onClick={() => {
                    fiatRef.current?.focus();
                    onFocus(true);
                }}
            >
                {fiat}
            </AmountInputFieldRight>
        </InputBlockStyled>
    );
};
