import { Table } from "@vertesia/ui/core";


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
                            <td className='w-1/3 font-semibold' >
                                <span>{property.name}</span>
                            </td>
                            <td className='w-2/3'>{property.value ?? 'undefined'}</td>
                        </tr>
                    ))
                }
            </tbody>

        </Table>
    )
}