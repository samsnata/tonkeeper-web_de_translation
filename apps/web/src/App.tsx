import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Account } from '@tonkeeper/core/dist/entries/account';
import { localizationText } from '@tonkeeper/core/dist/entries/language';
import { getApiConfig } from '@tonkeeper/core/dist/entries/network';
import { WalletVersion } from '@tonkeeper/core/dist/entries/wallet';
import { CopyNotification } from '@tonkeeper/uikit/dist/components/CopyNotification';
import { FooterGlobalStyle } from '@tonkeeper/uikit/dist/components/Footer';
import { HeaderGlobalStyle } from '@tonkeeper/uikit/dist/components/Header';
import { DarkThemeContext } from '@tonkeeper/uikit/dist/components/Icon';
import { GlobalListStyle } from '@tonkeeper/uikit/dist/components/List';
import { Loading } from '@tonkeeper/uikit/dist/components/Loading';
import { ModalsRoot } from '@tonkeeper/uikit/dist/components/ModalsRoot';
import { SybHeaderGlobalStyle } from '@tonkeeper/uikit/dist/components/SubHeader';
import { AmplitudeAnalyticsContext } from '@tonkeeper/uikit/dist/hooks/amplitude';
import { AppContext, IAppContext } from '@tonkeeper/uikit/dist/hooks/appContext';
import {
    AfterImportAction,
    AppSdkContext,
    OnImportAction
} from '@tonkeeper/uikit/dist/hooks/appSdk';
import { useLock } from '@tonkeeper/uikit/dist/hooks/lock';
import { StorageContext } from '@tonkeeper/uikit/dist/hooks/storage';
import { I18nContext, TranslationContext } from '@tonkeeper/uikit/dist/hooks/translation';
import { AppRoute } from '@tonkeeper/uikit/dist/libs/routes';
import { UnlockNotification } from '@tonkeeper/uikit/dist/pages/home/UnlockNotification';
import { UserThemeProvider } from '@tonkeeper/uikit/dist/providers/UserThemeProvider';
import { useDevSettings } from '@tonkeeper/uikit/dist/state/dev';
import { useUserFiatQuery } from '@tonkeeper/uikit/dist/state/fiat';
import { useUserLanguage } from '@tonkeeper/uikit/dist/state/language';
import { useProBackupState } from '@tonkeeper/uikit/dist/state/pro';
import { useTonendpoint, useTonenpointConfig } from '@tonkeeper/uikit/dist/state/tonendpoint';
import {
    useAccountsStateQuery,
    useActiveAccountQuery,
    useActiveTonNetwork
} from '@tonkeeper/uikit/dist/state/wallet';
import { GlobalStyle } from '@tonkeeper/uikit/dist/styles/globalStyle';
import React, { FC, PropsWithChildren, Suspense, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RouterProvider, createBrowserRouter, useNavigate } from 'react-router-dom';
import { MobileView } from './AppMobile';
import { BrowserAppSdk } from './libs/appSdk';
import { useAnalytics, useAppHeight, useLayout } from './libs/hooks';

const QrScanner = React.lazy(() => import('@tonkeeper/uikit/dist/components/QrScanner'));
const DesktopView = React.lazy(() => import('./AppDesktop'));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30000,
            refetchOnWindowFocus: false
        }
    }
});

const sdk = new BrowserAppSdk();
const TARGET_ENV = 'web';

export const App: FC = () => {
    return <RouterProvider router={router} />;
};

const Providers: FC<PropsWithChildren> = () => {
    const { t, i18n } = useTranslation();

    const translation = useMemo(() => {
        const languages = (import.meta.env.VITE_APP_LOCALES ?? 'en').split(',');
        const client: I18nContext = {
            t,
            i18n: {
                enable: true,
                reloadResources: i18n.reloadResources,
                changeLanguage: i18n.changeLanguage as any,
                language: i18n.language,
                languages: languages
            }
        };
        return client;
    }, [t, i18n]);

    return (
        <QueryClientProvider client={queryClient}>
            <Suspense>
                <AppSdkContext.Provider value={sdk}>
                    <TranslationContext.Provider value={translation}>
                        <StorageContext.Provider value={sdk.storage}>
                            <ThemeAndContent />
                        </StorageContext.Provider>
                    </TranslationContext.Provider>
                </AppSdkContext.Provider>
            </Suspense>
        </QueryClientProvider>
    );
};

const ThemeAndContent = () => {
    const { data } = useProBackupState();
    return (
        <UserThemeProvider isPro={data?.valid} isProSupported>
            <DarkThemeContext.Provider value={!data?.valid}>
                <GlobalStyle />
                <HeaderGlobalStyle />
                <FooterGlobalStyle />
                <SybHeaderGlobalStyle />
                <GlobalListStyle />
                <Loader />
                <UnlockNotification sdk={sdk} />
            </DarkThemeContext.Provider>
        </UserThemeProvider>
    );
};

const router = createBrowserRouter([
    {
        path: '/*',
        element: <Providers />
    }
]);

const Loader: FC = () => {
    const network = useActiveTonNetwork();
    const { data: activeAccount, isLoading: activeWalletLoading } = useActiveAccountQuery();
    const { data: accounts, isLoading: isWalletsLoading } = useAccountsStateQuery();
    const { data: lang, isLoading: isLangLoading } = useUserLanguage();
    const { data: fiat } = useUserFiatQuery();
    const { data: devSettings } = useDevSettings();

    const [ios, standalone] = useMemo(() => {
        return [sdk.isIOs(), sdk.isStandalone()] as const;
    }, []);

    const lock = useLock(sdk);
    const { i18n } = useTranslation();

    const tonendpoint = useTonendpoint({
        targetEnv: TARGET_ENV,
        build: sdk.version,
        network,
        lang
    });
    const { data: config } = useTonenpointConfig(tonendpoint);

    const navigate = useNavigate();
    useAppHeight();

    const { data: tracker } = useAnalytics(activeAccount || undefined, accounts, sdk.version);

    useEffect(() => {
        if (activeAccount && lang && i18n.language !== localizationText(lang)) {
            i18n.reloadResources([localizationText(lang)]).then(() =>
                i18n.changeLanguage(localizationText(lang))
            );
        }
    }, [activeAccount, i18n]);

    if (
        isWalletsLoading ||
        activeWalletLoading ||
        isLangLoading ||
        config === undefined ||
        lock === undefined ||
        fiat === undefined ||
        !devSettings
    ) {
        return <Loading />;
    }

    const context: IAppContext = {
        api: getApiConfig(config, network, import.meta.env.VITE_APP_TONCONSOLE_HOST),
        fiat,
        config,
        tonendpoint,
        standalone,
        extension: false,
        proFeatures: true,
        ios,
        defaultWalletVersion: WalletVersion.V5R1,
        env: {
            tgAuthBotId: import.meta.env.VITE_APP_TG_BOT_ID,
            stonfiReferralAddress: import.meta.env.VITE_APP_STONFI_REFERRAL_ADDRESS
        }
    };

    return (
        <AmplitudeAnalyticsContext.Provider value={tracker}>
            <OnImportAction.Provider value={navigate}>
                <AfterImportAction.Provider
                    value={() => navigate(AppRoute.home, { replace: true })}
                >
                    <AppContext.Provider value={context}>
                        <Content
                            activeAccount={activeAccount}
                            lock={lock}
                            standalone={standalone}
                        />
                        <CopyNotification hideSimpleCopyNotifications={!standalone} />
                        <Suspense>
                            <QrScanner />
                        </Suspense>
                        <ModalsRoot />
                    </AppContext.Provider>
                </AfterImportAction.Provider>
            </OnImportAction.Provider>
        </AmplitudeAnalyticsContext.Provider>
    );
};

const Content: FC<{
    activeAccount?: Account | null;
    lock: boolean;
    standalone: boolean;
}> = ({ activeAccount, lock, standalone }) => {
    const isMobile = useLayout();

    if (isMobile) {
        return <MobileView activeAccount={activeAccount} lock={lock} standalone={standalone} />;
    } else {
        return (
            <Suspense fallback={<Loading />}>
                <DesktopView activeAccount={activeAccount} lock={lock} />
            </Suspense>
        );
    }
};
