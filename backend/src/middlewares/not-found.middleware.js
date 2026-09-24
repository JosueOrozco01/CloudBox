const notFound = (req, res) => {
    return res.status(404).json({
        success: false,
        code: 'ROUTE_NOT_FOUND',
        message: 'Requested resource was not found'
    });
};

module.exports = notFound;