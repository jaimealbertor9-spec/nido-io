export default function PropertyCardSkeleton() {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm animate-pulse">
            {/* Image placeholder */}
            <div className="h-40 bg-gradient-to-br from-gray-200 to-gray-300" />

            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Badge */}
                <div className="h-5 w-20 bg-gray-200 rounded-full" />

                {/* Title */}
                <div className="h-6 bg-gray-200 rounded-lg w-3/4" />

                {/* Price */}
                <div className="h-8 bg-gray-200 rounded-lg w-1/2" />

                {/* Location */}
                <div className="h-4 bg-gray-200 rounded w-2/3" />
            </div>
        </div>
    );
}
