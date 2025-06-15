import { Table, VTooltip } from "@vertesia/ui/core";
import { Info } from "lucide-react";


interface PropertiesViewProps {
    className?: string,
    properties: { name: string, value: React.ReactNode, description?: string }[]
}
export function PropertiesView({ className, properties }: PropertiesViewProps) {
    return (
        <Table className={className}>
            <tbody>
                {
                    properties.map((property) => (
                        <tr key={property.name}>
                            <td className='w-1/3 font-semibold gap-2' >
                                <span>{property.name}</span>
                                {property.description &&
                                    <VTooltip
                                        description={property.description}
                                        placement="top">
                                        <Info className="size-3 ml-2 text-muted-foreground" />
                                    </VTooltip>
                                }
                            </td>
                            <td className='w-2/3'>{property.value ?? 'undefined'}</td>
                        </tr>
                    ))
                }
            </tbody>

        </Table>
    )
}