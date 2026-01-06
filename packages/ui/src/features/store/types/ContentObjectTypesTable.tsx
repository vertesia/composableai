import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { ContentObjectTypeItem } from "@vertesia/common";
import { Table, TBody, THead } from "@vertesia/ui/core";
import { useNavigate } from "@vertesia/ui/router";

dayjs.extend(relativeTime);

interface ContentObjectTypesTableProps {
    objects?: ContentObjectTypeItem[];
    isLoading: boolean;
}
export function ContentObjectTypesTable({ objects, isLoading }: ContentObjectTypesTableProps) {
    const navigate = useNavigate();

    return (
        <Table className="w-full">
            <THead>
                <tr>
                    <th>Name</th>
                    <th>Strict Mode</th>
                    <th>Semantic Chunking</th>
                    <th>Updated At</th>
                </tr>
            </THead>
            <TBody isLoading={isLoading && (!objects || objects.length === 0)} columns={4}>
                {
                    objects?.map((obj: any) => (
                        <tr key={obj.id} onClick={() => navigate(`/types/${obj.id}`)} className='cursor-pointer hover:bg-muted'>
                            <td>{obj.name}</td>
                            <td>{obj.strict_mode ? 'Yes' : 'No'}</td>
                            <td>{obj.is_chunkable ? 'Yes' : 'No'}</td>
                            <td>{dayjs(obj.updated_at).fromNow()}</td>
                        </tr>
                    ))
                }
            </TBody>
        </Table>
    )
}
