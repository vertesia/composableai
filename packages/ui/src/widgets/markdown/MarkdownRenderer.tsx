import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit, SKIP } from 'unist-util-visit';

function remarkRemoveComments() {
    return (tree: any) => {
        visit(tree, 'html', (node: any, index: number | undefined, parent: any) => {
            if (node.value && /<!--[\s\S]*?-->/.test(node.value)) {
                if (parent && typeof index === 'number' && parent.children) {
                    parent.children.splice(index, 1);
                    return [SKIP, index];
                }
            }
        });
    };
}

interface MarkdownRendererProps {
    children: string;
    components?: any;
    remarkPlugins?: any[];
    removeComments?: boolean;
}

export function MarkdownRenderer({ 
    children, 
    components, 
    remarkPlugins = [], 
    removeComments = true
}: MarkdownRendererProps) {
    const plugins = [remarkGfm, ...remarkPlugins];
    
    if (removeComments) {
        plugins.push(remarkRemoveComments);
    }

    return (
        <Markdown 
            remarkPlugins={plugins}
            components={components}
        >
            {children}
        </Markdown>
    );
}