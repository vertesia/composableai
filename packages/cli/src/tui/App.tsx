import { ClientProvider } from './context/ClientContext.js';
import { NavigationProvider, useNavigation } from './context/NavigationContext.js';
import { Layout } from './components/Layout.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { AgentListScreen } from './screens/AgentListScreen.js';
import { AgentConfigScreen } from './screens/AgentConfigScreen.js';
import { RunExecutionScreen } from './screens/RunExecutionScreen.js';
import { RunHistoryScreen } from './screens/RunHistoryScreen.js';
import { RunDetailScreen } from './screens/RunDetailScreen.js';
import { DocumentScreen } from './screens/DocumentScreen.js';
import { SkillBrowserScreen } from './screens/SkillBrowserScreen.js';
import { PromptEditorScreen } from './screens/PromptEditorScreen.js';
import { AnalyticsScreen } from './screens/AnalyticsScreen.js';

function Router() {
    const { current } = useNavigation();
    useKeyboard();

    switch (current.name) {
        case 'home':
            return <HomeScreen />;
        case 'agent-list':
            return <AgentListScreen />;
        case 'agent-config':
            return <AgentConfigScreen />;
        case 'run-execution':
            return <RunExecutionScreen />;
        case 'run-history':
            return <RunHistoryScreen />;
        case 'run-detail':
            return <RunDetailScreen />;
        case 'documents':
            return <DocumentScreen />;
        case 'skills':
            return <SkillBrowserScreen />;
        case 'prompt-editor':
            return <PromptEditorScreen />;
        case 'analytics':
            return <AnalyticsScreen />;
        default:
            return <HomeScreen />;
    }
}

export function App() {
    return (
        <ClientProvider>
            <NavigationProvider>
                <Layout>
                    <Router />
                </Layout>
            </NavigationProvider>
        </ClientProvider>
    );
}
