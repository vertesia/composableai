import { Fragment } from 'react';
import { Box, Text } from 'ink';
import { useNavigation, type ScreenName } from '../context/NavigationContext.js';

const TABS: { label: string; screen: ScreenName; key: string }[] = [
    { label: 'Home', screen: 'home', key: '1' },
    { label: 'Agents', screen: 'agent-list', key: '2' },
    { label: 'Runs', screen: 'run-history', key: '3' },
    { label: 'Docs', screen: 'documents', key: '4' },
    { label: 'Skills', screen: 'skills', key: '5' },
];

export function NavBar() {
    const { current } = useNavigation();

    return (
        <Box borderStyle="single" borderBottom={true} borderTop={false}
             borderLeft={false} borderRight={false} paddingX={1}>
            <Text bold color="cyan">VERTESIA </Text>
            <Text> </Text>
            {TABS.map((tab, i) => {
                const isActive = current.name === tab.screen;
                return (
                    <Fragment key={tab.screen}>
                        {i > 0 && <Text color="gray"> | </Text>}
                        <Text
                            bold={isActive}
                            color={isActive ? 'green' : 'white'}
                            underline={isActive}
                        >
                            {tab.key}:{tab.label}
                        </Text>
                    </Fragment>
                );
            })}
        </Box>
    );
}
