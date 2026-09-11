local referenced_ids = {}

local function trim(value)
    return string.match(value, '^%s*(.-)%s*$')
end

local function hides_display(style)
    for declaration in string.gmatch(style, '[^;]+') do
        local property, value = string.match(declaration, '^%s*([^:]+)%s*:%s*(.-)%s*$')
        if property ~= nil and string.lower(trim(property)) == 'display' then
            local normalized_value = string.lower(trim(value))
            if normalized_value == 'none' or string.match(normalized_value, '^none%s*!%s*important%s*$') then
                return true
            end
        end
    end

    return false
end

local function is_hidden(attributes)
    if attributes.hidden ~= nil then
        return true
    end

    return hides_display(attributes.style or '')
end

local function simplify_container(element)
    if is_hidden(element.attributes) then
        return {}
    end

    if element.identifier ~= '' and referenced_ids[element.identifier] then
        element.attr = pandoc.Attr(element.identifier, {}, {})
        return element
    end

    return element.content
end

local function simplify_attributed_element(element)
    if is_hidden(element.attributes) then
        return {}
    end

    element.attr = pandoc.Attr(element.identifier, {}, {})
    return element
end

function Pandoc(document)
    document:walk({
        Link = function(link)
            local identifier = string.match(link.target, '^#(.+)$')
            if identifier ~= nil then
                referenced_ids[identifier] = true
            end
        end,
    })

    return document:walk({
        Div = simplify_container,
        Header = simplify_attributed_element,
        Image = simplify_attributed_element,
        Link = simplify_attributed_element,
        Span = simplify_container,
        Table = simplify_attributed_element,
    })
end
