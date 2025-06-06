import { ContentObjectTypeItem } from "@vertesia/common";
import { TBody, Table } from "@vertesia/ui/core";
import { useNavigate } from "@vertesia/ui/router";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface ContentObjectTypesTableProps {
    objects?: ContentObjectTypeItem[];
    isLoading: boolean;
}
export function ContentObjectTypesTable({ objects, isLoading }: ContentObjectTypesTableProps) {
    const navigate = useNavigate();

    return (
        <div>
            <Table className="w-full">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Is Chunkable?</th>
                        <th>Updated At</th>
                    </tr>
                </thead>
                <TBody isLoading={isLoading} columns={3}>
                    {objects?.map((obj: any) => (
                        <tr key={obj.id} onClick={() => navigate(`/types/${obj.id}`)} className='cursor-pointer hover:bg-muted'>
                            <td>{obj.name}</td>
                            <td>{obj.is_chunkable ? 'Yes' : 'No'}</td>
                            <td>{dayjs(obj.updated_at).fromNow()}</td>
                        </tr>
                    ))}
                </TBody>
            </Table>
        </div>
    )
}
